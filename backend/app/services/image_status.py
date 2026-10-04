from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.task import ImageAnnotationStatus

async def ensure_status(
    db: AsyncSession,
    task_id: int,
    image_id: int,
    user_id: int,
) -> ImageAnnotationStatus:
    s = (await db.execute(
        select(ImageAnnotationStatus).where(
            ImageAnnotationStatus.task_id == task_id,
            ImageAnnotationStatus.image_id == image_id,
            ImageAnnotationStatus.user_id == user_id,
        )
    )).scalar_one_or_none()

    if s is None:
        s = ImageAnnotationStatus(
            task_id=task_id, image_id = image_id, user_id=user_id,
            status="pending",
        )
        db.add(s)
        await db.flush()
    return s

async def mark_in_progress(
    db: AsyncSession, task_id: int, image_id: int, user_id: int,
) -> None:
    s = await ensure_status(db, task_id, image_id, user_id)
    s.status = "in_progress"
    s.completed_at = None
    s.skip_reason = None

async def mark_completed(
    db: AsyncSession, task_id: int, image_id: int, user_id: int,
) -> None:
    s = await ensure_status(db, task_id, image_id, user_id)
    s.status = "completed"
    s.completed_at = datetime.now(timezone.utc)
    s.skip_reason = None


async def mark_skipped(
    db: AsyncSession, task_id: int, image_id: int, user_id: int, reason: str,
) -> None:
    s = await ensure_status(db, task_id, image_id, user_id)
    s.status = "skipped"
    s.completed_at = datetime.now(timezone.utc)


async def reset_to_pending(
    db: AsyncSession, task_id: int, image_id: int, user_id: int,
) -> None:
    s = await ensure_status(db, task_id, image_id, user_id)
    s.status = "pending"
    s.completed_at = None
    s.skip_reason = None