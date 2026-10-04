from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import Notification
from app.models.task import Task
from app.models.task_assignment import TaskAssignment


async def notify(
    db: AsyncSession,
    *,
    user_id: int,
    kind: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    project_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
) -> Notification:
    n = Notification(
        user_id=user_id, kind=kind, title=title, body=body,
        link=link, project_id=project_id,
        resource_type=resource_type, resource_id=resource_id,
    )
    db.add(n)
    return n


async def notify_task_assignees(
    db: AsyncSession,
    *,
    task: Task,
    exclude_user_id: Optional[int] = None,
    kind: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    role_filter: Optional[str] = None,
) -> None:
    q = select(TaskAssignment).where(TaskAssignment.task_id == task.id)
    if role_filter:
        q = q.where(TaskAssignment.role == role_filter)

    rows = (await db.execute(q)).scalars().all()
    for a in rows:
        if exclude_user_id and a.user_id == exclude_user_id:
            continue
        await notify(
            db,
            user_id=a.user_id,
            kind=kind,
            title=title,
            body=body,
            link=link or f"/tasks/{task.id}",
            project_id=task.project_id,
            resource_type="task",
            resource_id=task.id,
        )
