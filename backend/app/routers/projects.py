from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.task import Project

router = APIRouter()

async def _assert_can_edit(db: AsyncSession, project_id: int, user: User) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not your project")
    return project

@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    q = select(Project)
    if user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        q = q.where(Project.owner_id == user.id)
    return (await db.execute(q)).scalars().all()

@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    project = await _assert_can_edit(db, project_id, user)
    await db.delete(project)
    await db.commit()

@router.post("/projects")
async def create_project(name: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    project = Project(name=name, owner_id=user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project
