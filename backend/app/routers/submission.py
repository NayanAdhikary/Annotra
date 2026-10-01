from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task import Task, ImageAsset, ImageAnnotationStatus, Label
from app.models.annotation import Annotation
from app.schemas.submission import (
    SubmissionPreflight, SubmissionWarning, SubmissionRequest, SKIP_REASONS
)
from app.services.audit import audit
from app.services.notification import notify_task_assignees
from app.services.task_workflow import transition_task

router = APIRouter()

async def _preflight(db: AsyncSession, task_id: int, user_id: int) -> SubmissionPreflight:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")

    total = (await db.execute(
        select(func.count()).select_from(ImageAsset).where(ImageAsset.task_id == task_id)
    )).scalar_one()

    status_rows = (await db.execute(
        select(ImageAnnotationStatus.status, func.count())
        .where(ImageAnnotationStatus.task_id == task_id,
               ImageAnnotationStatus.user_id == user_id)
        .group_by(ImageAnnotationStatus.status)
    )).all()
    by_status = {s: c for s, c in status_rows}

    completed = by_status.get("completed", 0)
    skipped = by_status.get("skipped", 0)
    in_progress = by_status.get("in_progress", 0)
    pending = total - completed - skipped - in_progress

    ann_total = (await db.execute(
        select(func.count()).select_from(Annotation).where(Annotation.task_id == task_id)
    )).scalar_one()

    rejected = (await db.execute(
        select(func.count()).select_from(Annotation)
        .where(Annotation.task_id == task_id, Annotation.review_status == "rejected")
    )).scalar_one()

    label_count = (await db.execute(
        select(func.count()).select_from(Label).where(Label.task_id == task_id)
    )).scalar_one()

    warnings: list[SubmissionWarning] = []
    blocks = False

    if total == 0:
        warnings.append(SubmissionWarning(
            kind="no_annotations",
            message="This task has no images.",
            count=0,
        ))
        blocks = True

    if label_count == 0:
        warnings.append(SubmissionWarning(
            kind="empty_labels",
            message="No labels defined. Add at least one label before submitting.",
            count=0,
        ))
        blocks = True

    if pending > 0:
        warnings.append(SubmissionWarning(
            kind="incomplete_images",
            message=f"{pending} image{'s' if pending != 1 else ''} never opened.",
            count=pending,
            detail="Every image must be at least opened before submitting.",
        ))
        blocks = True

    if in_progress > 0:
        warnings.append(SubmissionWarning(
            kind="incomplete_images",
            message=f"{in_progress} image{'s' if in_progress != 1 else ''} started but not marked complete.",
            count=in_progress,
            detail="Mark them complete, or skip them with a reason.",
        ))

    if ann_total == 0:
        warnings.append(SubmissionWarning(
            kind="no_annotations",
            message="No annotations drawn. Submit an empty task?",
            count=0,
        ))

    if rejected > 0:
        warnings.append(SubmissionWarning(
            kind="unresolved_rejections",
            message=f"{rejected} annotation{'s' if rejected != 1 else ''} were rejected by the reviewer.",
            count=rejected,
            detail="Fix the rejected items before resubmitting, or add a note explaining why.",
        ))

    return SubmissionPreflight(
        total_images=total,
        completed_images=completed,
        skipped_images=skipped,
        pending_images=pending + in_progress,
        total_annotations=ann_total,
        warnings=warnings,
        can_submit=not blocks,
        blocks_submission=blocks,
    )

@router.get("/tasks/{task_id}/submission/preflight", response_model=SubmissionPreflight)
async def preflight(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _preflight(db, task_id, user.id)

@router.post("/tasks/{task_id}/submission")
async def submit_for_review(
    task_id: int, payload: SubmissionRequest, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")

    check = await _preflight(db, task_id, user.id)

    if check.blocks_submission and not payload.force:
        raise HTTPException(
            422,
            detail={
                "message": "Task is not ready to submit",
                "preflight": check.model_dump(),
            },
        )

    if check.warnings and not payload.force:
        raise HTTPException(
            409,
            detail={
                "message": "Submission has warnings. Confirm to proceed.",
                "preflight": check.model_dump(),
            },
        )

    old_status = task.status
    task = await transition_task(db, task, "review", user)
    task.last_submitted_at = datetime.now(timezone.utc)
    task.last_submitted_by = user.id

    await notify_task_assignees(
        db, task=task, exclude_user_id=user.id,
        kind="task_submitted_for_review",
        title=f"'{task.name}' is ready for review",
        body=(payload.note or f"Submitted by {user.full_name or user.username}"),
        role_filter="reviewer",
    )

    if payload.note:
        from app.models.task import TaskComment
        db.add(TaskComment(
            task_id=task_id,
            user_id=user.id,
            user_email=user.email,
            user_name=user.full_name or user.username,
            body=f"[Submission note] {payload.note}",
        ))

    await audit(db, user=user, action="task.submitted",
                resource_type="task", resource_id=task_id,
                meta={
                    "from": old_status, "to": task.status,
                    "completed_images": check.completed_images,
                    "total_images": check.total_images,
                    "had_warnings": len(check.warnings) > 0,
                    "note": payload.note,
                },
                request=request)
    await db.commit()

    return {
        "status": task.status,
        "submitted_at": task.last_submitted_at.isoformat(),
        "submitted_by": task.last_submitted_by,
    }

@router.get("/skip-reasons")
async def skip_reasons():
    return {"reasons": SKIP_REASONS}
