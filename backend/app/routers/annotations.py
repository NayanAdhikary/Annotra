from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
from app.services.audit import audit
from app.services import cache

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.annotation import Annotation
from app.models.task import Label, Task, Project
from app.models.user import User, UserRole
from app.schemas.annotation import (
    AnnotationCreate, AnnotationUpdate, AnnotationResponse,
    BulkAnnotationCreate, CVATAnnotationExport, CVATExportShape,
    BulkAnnotationPatch
)
from app.services.attribute_validation import validate_annotation_attributes

async def _validate_attrs(db: AsyncSession, label_id: int, attrs: list):
    label = await db.get(Label, label_id)
    if label is None:
        return []
    return validate_annotation_attributes(label.attributes or [], attrs)

router = APIRouter()

async def _assert_can_edit_task(db: AsyncSession, task_id: int, user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    if task.status == "completed":
        raise HTTPException(423, "This task is completed and locked for editing")
    if task.status == "archived":
        raise HTTPException(423, "This task is archived")
    
    project = await db.get(Project, task.project_id)
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your project")
    return task

async def _assert_can_edit(db: AsyncSession, ann_id: int, user: User) -> Annotation:
    ann = await db.get(Annotation, ann_id)
    if ann is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Annotation not found")
    await _assert_can_edit_task(db, ann.task_id, user)
    return ann


async def _ensure_label_exists(db: AsyncSession, label_id: int, task_id: int):
    res = await db.execute(
        select(Label).where(Label.id == label_id, Label.task_id == task_id)
    )
    if res.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid label for this task")


@router.post("/tasks/{task_id}/annotations",
             response_model=AnnotationResponse,
             status_code=status.HTTP_201_CREATED)
async def create_annotation(
    task_id: int,
    payload: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_can_edit_task(db, task_id, user)
    await _ensure_label_exists(db, payload.label_id, task_id)
    normalized = await _validate_attrs(db, payload.label_id, payload.attributes)
    ann = Annotation(
        task_id=task_id,
        image_id=getattr(payload, "image_id", None),
        label_id=payload.label_id,
        shape_type=payload.shape_type.value,
        points=payload.points,
        frame=payload.frame,
        attributes=normalized,
        occluded=payload.occluded,
        group_id=payload.group_id,
        created_by=user.id,
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
    return ann


@router.post("/tasks/{task_id}/annotations/bulk",
             response_model=List[AnnotationResponse],
             status_code=status.HTTP_201_CREATED)
async def bulk_create(task_id: int, payload: BulkAnnotationCreate,
                      db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """Used by: 68-point face landmarks, YOLO-paste, CSV import, copy-paste."""
    await _assert_can_edit_task(db, task_id, user)
    created = []
    for item in payload.annotations:
        await _ensure_label_exists(db, item.label_id, task_id)
        normalized = await _validate_attrs(db, item.label_id, item.attributes)
        ann = Annotation(
            task_id=task_id,
            label_id=item.label_id,
            shape_type=item.shape_type.value,
            points=item.points,
            frame=item.frame,
            attributes=normalized,
            occluded=item.occluded,
            group_id=item.group_id,
            created_by=user.id,
        )
        db.add(ann)
        created.append(ann)
    await db.commit()
    for a in created:
        await db.refresh(a)
    return created


@router.patch("/annotations/{ann_id}", response_model=AnnotationResponse)
async def update_annotation(ann_id: int, payload: AnnotationUpdate,
                            request: Request,
                            db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    ann = await _assert_can_edit(db, ann_id, user)

    # --- Optimistic concurrency check ---
    # Client sends `If-Match: <updated_at-iso>` if it has a known version.
    # If it doesn't match, another user changed the annotation since we saw it.
    if_match = request.headers.get("if-match")
    if if_match:
        current_iso = ann.updated_at.isoformat() if ann.updated_at else ""
        if if_match != current_iso:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={
                    "message": "Annotation was modified by another user",
                    "current": {
                        "id": ann.id,
                        "points": ann.points,
                        "label_id": ann.label_id,
                        "updated_at": current_iso,
                    },
                },
            )

    data = payload.model_dump(exclude_unset=True)

    if "label_id" in data and data["label_id"] != ann.label_id:
        await _ensure_label_exists(db, data["label_id"], ann.task_id)

    if "points" in data and data["points"] is not None:
        from app.schemas.annotation import MIN_COORDS, ShapeType
        st = ShapeType(ann.shape_type)
        if st != ShapeType.MASK:
            if len(data["points"]) < MIN_COORDS[st]:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"{st.value} requires >= {MIN_COORDS[st]} coords"
                )
            if len(data["points"]) % 2:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "odd coord count")

    if "attributes" in data or "label_id" in data:
        target_label_id = data.get("label_id", ann.label_id)
        target_attrs = data.get("attributes", ann.attributes)
        normalized = await _validate_attrs(db, target_label_id, target_attrs)
        data["attributes"] = normalized

    for k, v in data.items():
        setattr(ann, k, v)

    await db.commit()
    await db.refresh(ann)
    return ann


@router.delete("/annotations/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(ann_id: int,
                            request: Request,
                            db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    ann = await _assert_can_edit(db, ann_id, user)
    await audit(db, user=user, action="annotation.delete",
                resource_type="annotation", resource_id=ann.id, request=request)
    await db.execute(delete(Annotation).where(Annotation.id == ann_id))
    await db.commit()


@router.get("/tasks/{task_id}/annotations")
async def get_annotations(
    task_id: int,
    image_id: Optional[int] = Query(default=None),
    frame: Optional[int] = Query(default=None),
    review_status: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    limit: int = Query(default=500, le=2000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Always bounded. Prefer per-image queries for the workspace.
    Response format keeps `shapes` for backward compatibility, adds pagination
    metadata at the top.
    """
    from app.models.annotation import Annotation
    from sqlalchemy import func

    where = [Annotation.task_id == task_id]
    if image_id is not None:
        where.append(Annotation.image_id == image_id)
    if frame is not None:
        where.append(Annotation.frame == frame)
    if review_status:
        where.append(Annotation.review_status == review_status)
    if source:
        where.append(Annotation.source == source)

    total = (await db.execute(
        select(func.count()).select_from(Annotation).where(*where)
    )).scalar_one()

    rows = (await db.execute(
        select(Annotation).where(*where)
        .order_by(Annotation.frame, Annotation.id)
        .limit(limit).offset(offset)
    )).scalars().all()

    shapes = [
        {
            "id": a.id,
            "type": a.shape_type,
            "frame": a.frame,
            "image_id": a.image_id,
            "label_id": a.label_id,
            "group": a.group_id,
            "source": a.source,
            "attributes": a.attributes,
            "points": a.points,
            "occluded": a.occluded,
            "review_status": a.review_status,
            "reviewed_by": a.reviewed_by,
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            "review_comment": a.review_comment,
            "created_by": a.created_by,
        }
        for a in rows
    ]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "shapes": shapes,
    }


@router.get("/tasks/{task_id}/annotations/stream")
async def stream_annotations(
    task_id: int,
    after_id: Optional[int] = Query(default=None),
    limit: int = Query(default=1000, le=5000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Keyset pagination. `after_id` is the last id you saw.
    Stable, O(1) regardless of depth.
    """
    from app.models.annotation import Annotation
    
    stmt = select(Annotation).where(Annotation.task_id == task_id)
    if after_id is not None:
        stmt = stmt.where(Annotation.id > after_id)
    stmt = stmt.order_by(Annotation.id).limit(limit)

    rows = (await db.execute(stmt)).scalars().all()
    shapes = [
        {
            "id": a.id,
            "type": a.shape_type,
            "frame": a.frame,
            "image_id": a.image_id,
            "label_id": a.label_id,
            "group": a.group_id,
            "source": a.source,
            "attributes": a.attributes,
            "points": a.points,
            "occluded": a.occluded,
            "review_status": a.review_status,
            "reviewed_by": a.reviewed_by,
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            "review_comment": a.review_comment,
            "created_by": a.created_by,
        }
        for a in rows
    ]
    return {
        "shapes": shapes,
        "next_cursor": rows[-1].id if len(rows) == limit else None,
    }


@router.patch("/tasks/{task_id}/annotations/bulk")
async def bulk_patch(
    task_id: int,
    payload: BulkAnnotationPatch,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Atomic bulk patch. All-or-nothing within one transaction."""
    await _assert_can_edit_task(db, task_id, user)
    # Fetch all target rows in one query
    res = await db.execute(
        select(Annotation).where(
            Annotation.id.in_(payload.ids),
            Annotation.task_id == task_id,
        )
    )
    anns = res.scalars().all()

    if len(anns) != len(payload.ids):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Expected {len(payload.ids)} annotations, found {len(anns)}",
        )

    data = payload.patch.model_dump(exclude_unset=True)

    # If label_id is being changed, validate it once against the task
    if "label_id" in data:
        await _ensure_label_exists(db, data["label_id"], task_id)

    # If points is being changed, validate each against its shape type
    if "points" in data and data["points"] is not None:
        from app.schemas.annotation import MIN_COORDS, ShapeType
        for a in anns:
            st = ShapeType(a.shape_type)
            if st != ShapeType.MASK:
                if len(data["points"]) < MIN_COORDS[st]:
                    raise HTTPException(
                        status.HTTP_422_UNPROCESSABLE_ENTITY,
                        f"annotation {a.id} ({st.value}) needs >= {MIN_COORDS[st]} coords"
                    )

    for a in anns:
        for k, v in data.items():
            setattr(a, k, v)

    await db.commit()
    return {"updated": len(anns), "ids": [a.id for a in anns]}


@router.post("/tasks/{task_id}/annotations/bulk-delete")
async def bulk_delete(
    task_id: int,
    ids: List[int],
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete N annotations in one transaction. Returns count actually removed."""
    await _assert_can_edit_task(db, task_id, user)
    res = await db.execute(
        delete(Annotation).where(
            Annotation.id.in_(ids),
            Annotation.task_id == task_id,
        )
    )
    if res.rowcount != len(ids):
        await db.rollback()
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Expected {len(ids)} annotations, found {res.rowcount}",
        )
    await audit(db, user=user, action="annotation.delete",
                resource_type="annotation", meta={"ids": ids, "count": res.rowcount},
                request=request)
    await db.commit()
    return {"deleted": res.rowcount}