from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task import Task, ImageAsset, ImageAnnotationStatus
from app.models.annotation import Annotation
from app.services.image_status import mark_completed, mark_skipped, reset_to_pending
from app.services.audit import audit

router = APIRouter()


class StatusResponse(BaseModel):
    image_id: int
    status: str
    skip_reason: str | None
    annotation_count: int
    started_at: datetime | None
    completed_at: datetime | None


class StatusUpdate(BaseModel):
    status: str  # "completed" | "skipped" | "pending"
    skip_reason: str | None = None


class TaskProgressResponse(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    skipped: int
    images_with_annotations: int
    percent_complete: float


@router.get("/tasks/{task_id}/image-status")
async def list_image_status(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return status for every image in the task, for the current user."""
    images = (await db.execute(
        select(ImageAsset).where(ImageAsset.task_id == task_id).order_by(ImageAsset.id)
    )).scalars().all()

    rows = (await db.execute(
        select(ImageAnnotationStatus).where(
            ImageAnnotationStatus.task_id == task_id,
            ImageAnnotationStatus.user_id == user.id,
        )
    )).scalars().all()
    by_image = {r.image_id: r for r in rows}

    # Annotation counts per image (fast aggregate)
    counts = dict((await db.execute(
        select(Annotation.image_id, func.count())
        .where(Annotation.task_id == task_id)
        .group_by(Annotation.image_id)
    )).all())

    out = []
    for img in images:
        s = by_image.get(img.id)
        out.append({
            "image_id": img.id,
            "status": s.status if s else "pending",
            "skip_reason": s.skip_reason if s else None,
            "annotation_count": counts.get(img.id, 0),
            "started_at": s.started_at.isoformat() if s and s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s and s.completed_at else None,
        })
    return out


@router.get("/tasks/{task_id}/progress", response_model=TaskProgressResponse)
async def task_progress(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    total = (await db.execute(
        select(func.count()).select_from(ImageAsset).where(ImageAsset.task_id == task_id)
    )).scalar_one()

    rows = (await db.execute(
        select(ImageAnnotationStatus.status, func.count())
        .where(
            ImageAnnotationStatus.task_id == task_id,
            ImageAnnotationStatus.user_id == user.id,
        )
        .group_by(ImageAnnotationStatus.status)
    )).all()
    by_status = {s: c for s, c in rows}

    with_ann = (await db.execute(
        select(func.count(func.distinct(Annotation.image_id)))
        .where(Annotation.task_id == task_id)
    )).scalar_one()

    completed = by_status.get("completed", 0)
    skipped = by_status.get("skipped", 0)
    pending = total - completed - skipped - by_status.get("in_progress", 0)

    return TaskProgressResponse(
        total=total,
        pending=max(0, pending),
        in_progress=by_status.get("in_progress", 0),
        completed=completed,
        skipped=skipped,
        images_with_annotations=with_ann,
        percent_complete=(completed + skipped) / total if total else 0.0,
    )


@router.patch("/tasks/{task_id}/images/{image_id}/status", response_model=StatusResponse)
async def update_image_status(
    task_id: int, image_id: int, payload: StatusUpdate, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    img = await db.get(ImageAsset, image_id)
    if img is None or img.task_id != task_id:
        raise HTTPException(404, "Image not found in task")

    if payload.status == "completed":
        await mark_completed(db, task_id, image_id, user.id)
    elif payload.status == "skipped":
        if not payload.skip_reason:
            raise HTTPException(422, "skip_reason is required when skipping")
        await mark_skipped(db, task_id, image_id, user.id, payload.skip_reason)
    elif payload.status == "pending":
        await reset_to_pending(db, task_id, image_id, user.id)
    else:
        raise HTTPException(422, f"Invalid status: {payload.status}")

    await audit(db, user=user, action=f"image.{payload.status}",
                resource_type="image", resource_id=image_id,
                meta={"task_id": task_id, "reason": payload.skip_reason},
                request=request)
    await db.commit()

    counts = (await db.execute(
        select(func.count()).select_from(Annotation).where(Annotation.image_id == image_id)
    )).scalar_one()

    from app.services.image_status import ensure_status
    s = await ensure_status(db, task_id, image_id, user.id)

    return StatusResponse(
        image_id=image_id,
        status=s.status,
        skip_reason=s.skip_reason,
        annotation_count=counts,
        started_at=s.started_at,
        completed_at=s.completed_at,
    )