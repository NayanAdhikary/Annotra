from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from app.services.audit import audit

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

router = APIRouter()

async def _assert_can_edit_task(db: AsyncSession, task_id: int, user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
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
    ann = Annotation(
        task_id=task_id,
        image_id=getattr(payload, "image_id", None),
        label_id=payload.label_id,
        shape_type=payload.shape_type.value,
        points=payload.points,
        frame=payload.frame,
        attributes=payload.attributes,
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
        ann = Annotation(
            task_id=task_id,
            label_id=item.label_id,
            shape_type=item.shape_type.value,
            points=item.points,
            frame=item.frame,
            attributes=item.attributes,
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
        if len(data["points"]) < MIN_COORDS[st]:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{st.value} requires >= {MIN_COORDS[st]} coords"
            )
        if len(data["points"]) % 2:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "odd coord count")

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


@router.get("/tasks/{task_id}/annotations", response_model=List[AnnotationResponse])
async def get_annotations(task_id: int, frame: int | None = None,
                          db: AsyncSession = Depends(get_db)):
    q = select(Annotation).where(Annotation.task_id == task_id)
    if frame is not None:
        q = q.where(Annotation.frame == frame)
    res = await db.execute(q)
    return res.scalars().all()


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