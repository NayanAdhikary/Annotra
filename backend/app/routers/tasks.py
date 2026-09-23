from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.task import Project, Task, Label
from app.core.deps import get_current_user
from app.models.user import User, UserRole

router = APIRouter()

async def _assert_can_edit(db: AsyncSession, task_id: int, user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    project = await db.get(Project, task.project_id)
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not your project")
    return task

@router.post("/tasks")
async def create_task(project_id: int, name: str, task_type: str = "image",
                      db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not your project")
    
    task = Task(project_id=project_id, name=name, task_type=task_type)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task