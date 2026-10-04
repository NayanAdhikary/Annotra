from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.task import Task
from app.models.annotation import Annotation
from app.models.annotation_comment import AnnotationComment
from app.models.task_assignment import TaskAssignment
from app.schemas.review import (
    ReviewSingleRequest, ReviewQueueStats, ReviewQueueResponse,
    AnnotationCommentCreate, AnnotationCommentResponse,
)
from app.services.audit import audit

router = APIRouter()


async def _assert_can_review(db: AsyncSession, task_id: int, user: User) -> None:
    if user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        return
    if user.role != UserRole.REVIEWER.value:
        raise HTTPException(403, "Not a reviewer")
    assignment = (await db.execute(
        select(TaskAssignment).where(
            TaskAssignment.task_id == task_id,
            TaskAssignment.user_id == user.id,
            TaskAssignment.role == "reviewer",
        )
    )).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(403, "You are not assigned as reviewer on this task")


# ---------------- Single annotation review ----------------

@router.post("/annotations/{ann_id}/review")
async def review_annotation(
    ann_id: int,
    payload: ReviewSingleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ann = await db.get(Annotation, ann_id)
    if ann is None:
        raise HTTPException(404, "Annotation not found")

    await _assert_can_review(db, ann.task_id, user)

    old_status = ann.review_status
    ann.review_status = payload.status
    ann.reviewed_by = user.id
    ann.reviewed_at = datetime.now(timezone.utc)

    if payload.status == "rejected":
        parts = []
        if payload.reason:
            parts.append(f"[{payload.reason}]")
        if payload.comment:
            parts.append(payload.comment)
        ann.review_comment = " ".join(parts) if parts else None
    else:
        ann.review_comment = payload.comment

    if payload.status == "rejected" and ann.created_by and ann.created_by != user.id:
        from app.models.task import Task
        from app.services.notifications import notify
        task = await db.get(Task, ann.task_id)
        await notify(
            db,
            user_id=ann.created_by,
            kind="review_rejected",
            title=f"Annotation rejected on '{task.name}'",
            body=payload.comment or "Reviewer rejected this annotation.",
            link=f"/tasks/{task.id}?annotation={ann.id}",
            project_id=task.project_id,
            resource_type="annotation",
            resource_id=ann.id,
        )

    await audit(db, user=user, action=f"annotation.review_{payload.status}",
                resource_type="annotation", resource_id=ann_id,
                meta={"from": old_status, "reason": payload.reason},
                request=request)
    await db.commit()
    await db.refresh(ann)

    # Notify the author on rejection
    if payload.status == "rejected" and ann.created_by and ann.created_by != user.id:
        from app.services.notifications import notify
        task = await db.get(Task, ann.task_id)
        await notify(
            db,
            user_id=ann.created_by,
            kind="review_rejected",
            title=f"Annotation rejected on '{task.name if task else 'task'}'",
            body=payload.comment or "Reviewer rejected this annotation.",
            link=f"/tasks/{ann.task_id}?annotation={ann.id}",
            resource_type="annotation",
            resource_id=ann.id,
        )
        await db.commit()

    return ann


@router.post("/annotations/{ann_id}/review/reset")
async def reset_review(
    ann_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ann = await db.get(Annotation, ann_id)
    if ann is None:
        raise HTTPException(404, "Annotation not found")

    if user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Only admins and managers can reset a review")

    ann.review_status = "pending"
    ann.reviewed_by = None
    ann.reviewed_at = None
    ann.review_comment = None

    await audit(db, user=user, action="annotation.review_reset",
                resource_type="annotation", resource_id=ann_id,
                request=request)
    await db.commit()
    await db.refresh(ann)
    return ann


# ---------------- Review queue ----------------

@router.get("/tasks/{task_id}/review-queue", response_model=ReviewQueueResponse)
async def review_queue(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_can_review(db, task_id, user)

    rows = (await db.execute(
        select(Annotation.id, Annotation.review_status)
        .where(Annotation.task_id == task_id)
    )).all()

    counts = {"pending": 0, "accepted": 0, "rejected": 0, "fixed": 0}
    pending_ids, rejected_ids = [], []
    for ann_id, status in rows:
        s = status or "pending"
        counts[s] = counts.get(s, 0) + 1
        if s == "pending":
            pending_ids.append(ann_id)
        elif s == "rejected":
            rejected_ids.append(ann_id)

    total = len(rows)
    reviewed = counts["accepted"] + counts["rejected"] + counts["fixed"]
    percent = (reviewed / total) if total else 0.0

    return ReviewQueueResponse(
        stats=ReviewQueueStats(
            pending=counts["pending"],
            accepted=counts["accepted"],
            rejected=counts["rejected"],
            fixed=counts["fixed"],
            total=total,
            percent_reviewed=round(percent, 4),
        ),
        pending_ids=pending_ids,
        rejected_ids=rejected_ids,
    )


# ---------------- Admin bulk operations ----------------

@router.post("/tasks/{task_id}/review/approve-all")
async def approve_all(
    task_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Admin or manager only")

    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(Annotation).where(Annotation.task_id == task_id)
    )).scalars().all()

    for a in rows:
        a.review_status = "accepted"
        a.reviewed_by = user.id
        a.reviewed_at = now

    await audit(db, user=user, action="task.review_approve_all",
                resource_type="task", resource_id=task_id,
                meta={"count": len(rows)}, request=request)
    await db.commit()
    return {"approved": len(rows)}


@router.post("/tasks/{task_id}/review/reset-all")
async def reset_all(
    task_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Admin or manager only")

    rows = (await db.execute(
        select(Annotation).where(Annotation.task_id == task_id)
    )).scalars().all()

    for a in rows:
        a.review_status = "pending"
        a.reviewed_by = None
        a.reviewed_at = None
        a.review_comment = None

    await audit(db, user=user, action="task.review_reset_all",
                resource_type="task", resource_id=task_id,
                meta={"count": len(rows)}, request=request)
    await db.commit()
    return {"reset": len(rows)}


# ---------------- Annotation comments ----------------

@router.get("/annotations/{ann_id}/comments",
            response_model=list[AnnotationCommentResponse])
async def list_comments(
    ann_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ann = await db.get(Annotation, ann_id)
    if ann is None:
        raise HTTPException(404, "Annotation not found")
    rows = (await db.execute(
        select(AnnotationComment)
        .where(AnnotationComment.annotation_id == ann_id)
        .order_by(AnnotationComment.created_at.asc())
    )).scalars().all()
    return rows


@router.post("/annotations/{ann_id}/comments",
             response_model=AnnotationCommentResponse, status_code=201)
async def create_comment(
    ann_id: int,
    payload: AnnotationCommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ann = await db.get(Annotation, ann_id)
    if ann is None:
        raise HTTPException(404, "Annotation not found")

    c = AnnotationComment(
        annotation_id=ann_id,
        user_id=user.id,
        user_email=user.email,
        user_name=user.full_name or user.username,
        body=payload.body,
    )
    db.add(c)
    await db.flush()

    from app.models.task import Task
    from app.services.notifications import notify_task_assignees
    task = await db.get(Task, ann.task_id)
    await notify_task_assignees(
        db, task=task, exclude_user_id=user.id,
        kind="comment_added",
        title=f"New comment on '{task.name}'",
        body=payload.body,
        link=f"/tasks/{task.id}?annotation={ann.id}",
    )

    await db.commit()
    await db.refresh(c)
    return c


@router.delete("/annotations/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await db.get(AnnotationComment, comment_id)
    if c is None:
        raise HTTPException(404, "Comment not found")
    if c.user_id != user.id and user.role not in (
        UserRole.ADMIN.value, UserRole.MANAGER.value,
    ):
        raise HTTPException(403, "Not allowed")
    await db.delete(c)
    await db.commit()