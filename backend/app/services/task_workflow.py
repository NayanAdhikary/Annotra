from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.user import User, UserRole


# Allowed transitions. Key = current status, value = set of next statuses.
TRANSITIONS: dict[str, set[str]] = {
    "annotation": {"review", "archived"},
    "review":     {"completed", "annotation", "archived"},   # reject → back to annotation
    "completed":  {"archived", "review"},                    # reopen if needed
    "archived":   {"annotation"},                            # unarchive
}


# Which roles can drive each transition. Admin/manager override everything.
TRANSITION_ROLES: dict[tuple[str, str], set[str]] = {
    ("annotation", "review"):     {"annotator", "admin", "manager"},
    ("review", "completed"):      {"reviewer", "admin", "manager"},
    ("review", "annotation"):     {"reviewer", "admin", "manager"},  # reject
    ("completed", "archived"):    {"admin", "manager"},
    ("archived", "annotation"):   {"admin", "manager"},
    ("completed", "review"):      {"admin", "manager"},
    ("annotation", "archived"):   {"admin", "manager"},
    ("review", "archived"):       {"admin", "manager"},
}


async def transition_task(
    db: AsyncSession,
    task: Task,
    to_status: str,
    user: User,
) -> Task:
    """Apply a state transition. Raises 400/403 on invalid move."""
    current = task.status
    if to_status == current:
        return task

    allowed_next = TRANSITIONS.get(current, set())
    if to_status not in allowed_next:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot move from '{current}' to '{to_status}'",
        )

    required = TRANSITION_ROLES.get((current, to_status), set())
    if user.role not in required:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Role '{user.role}' cannot move from '{current}' to '{to_status}'",
        )

    task.status = to_status
    now = datetime.now(timezone.utc)

    if to_status == "completed":
        task.completed_at = now
    elif to_status == "archived":
        task.archived_at = now
    elif to_status == "annotation":
        # Reopening — clear completion flags
        task.completed_at = None
        task.archived_at = None

    await db.commit()
    await db.refresh(task)
    return task
