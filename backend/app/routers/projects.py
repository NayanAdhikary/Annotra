from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.task import Project, Task, Label, ImageAsset
from app.models.annotation import Annotation
from app.schemas.project import (
    ProjectCreate, ProjectResponse, TaskCreate, TaskResponse,
)

router = APIRouter()


async def _project_stats(db: AsyncSession, project_id: int) -> tuple[int, int]:
    task_count = (await db.execute(
        select(func.count()).select_from(Task).where(Task.project_id == project_id)
    )).scalar_one()
    image_count = (await db.execute(
        select(func.count()).select_from(ImageAsset)
        .join(Task, Task.id == ImageAsset.task_id)
        .where(Task.project_id == project_id)
    )).scalar_one()
    return task_count, image_count


async def _assert_project_access(db: AsyncSession, project_id: int, user: User) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if project.owner_id != user.id and user.role not in (
        UserRole.ADMIN.value, UserRole.MANAGER.value,
    ):
        raise HTTPException(403, "Not your project")
    return project


# ---------------- Projects ----------------

@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Project).order_by(Project.created_at.desc())
    if user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        q = q.where(Project.owner_id == user.id)

    projects = (await db.execute(q)).scalars().all()
    out = []
    for p in projects:
        tc, ic = await _project_stats(db, p.id)
        out.append(ProjectResponse(
            id=p.id, name=p.name, description=p.description,
            owner_id=p.owner_id, task_count=tc, image_count=ic,
            created_at=p.created_at,
        ))
    return out


@router.post("/projects", response_model=ProjectResponse,
             status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(
        name=payload.name,
        description=payload.description,
        owner_id=user.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        owner_id=project.owner_id, task_count=0, image_count=0,
        created_at=project.created_at,
    )


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _assert_project_access(db, project_id, user)
    tc, ic = await _project_stats(db, project_id)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        owner_id=project.owner_id, task_count=tc, image_count=ic,
        created_at=project.created_at,
    )


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _assert_project_access(db, project_id, user)
    await db.delete(project)
    await db.commit()


# ---------------- Tasks ----------------

async def _task_stats(db: AsyncSession, task_id: int) -> tuple[int, int, int]:
    ic = (await db.execute(
        select(func.count()).select_from(ImageAsset).where(ImageAsset.task_id == task_id)
    )).scalar_one()
    lc = (await db.execute(
        select(func.count()).select_from(Label).where(Label.task_id == task_id)
    )).scalar_one()
    ac = (await db.execute(
        select(func.count(func.distinct(Annotation.image_id)))
        .where(Annotation.task_id == task_id)
    )).scalar_one()
    return ic, lc, ac


@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_project_access(db, project_id, user)
    tasks = (await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())
    )).scalars().all()

    out = []
    for t in tasks:
        ic, lc, ac = await _task_stats(db, t.id)
        out.append(TaskResponse(
            id=t.id, project_id=t.project_id, name=t.name,
            task_type=t.task_type, status=t.status,
            image_count=ic, label_count=lc, annotated_count=ac,
            created_at=t.created_at,
        ))
    return out


@router.post("/projects/{project_id}/tasks", response_model=TaskResponse,
             status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: int,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_project_access(db, project_id, user)
    if payload.task_type not in ("image", "video"):
        raise HTTPException(422, "task_type must be 'image' or 'video'")

    task = Task(project_id=project_id, name=payload.name, task_type=payload.task_type)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskResponse(
        id=task.id, project_id=task.project_id, name=task.name,
        task_type=task.task_type, status=task.status,
        image_count=0, label_count=0, annotated_count=0,
        created_at=task.created_at,
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    ic, lc, ac = await _task_stats(db, task_id)
    return TaskResponse(
        id=task.id, project_id=task.project_id, name=task.name,
        task_type=task.task_type, status=task.status,
        image_count=ic, label_count=lc, annotated_count=ac,
        created_at=task.created_at,
    )
