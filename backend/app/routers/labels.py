from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from typing import List
from app.services.audit import audit

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.task import Label, Task
from app.models.annotation import Annotation
from app.schemas.label import LabelCreate, LabelUpdate, LabelResponse
from app.models.user import User, UserRole
from app.models.task import Project

router = APIRouter()

async def _assert_can_edit_task(db: AsyncSession, task_id: int, user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    project = await db.get(Project, task.project_id)
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not your project")
    return task

async def _assert_can_edit(db: AsyncSession, label_id: int, user: User) -> Label:
    label = await db.get(Label, label_id)
    if label is None:
        raise HTTPException(404, "Label not found")
    await _assert_can_edit_task(db, label.task_id, user)
    return label


@router.get("/tasks/{task_id}/labels", response_model=List[LabelResponse])
async def list_labels(task_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Label).where(Label.task_id == task_id).order_by(Label.id))
    return res.scalars().all()


@router.post("/tasks/{task_id}/labels",
             response_model=LabelResponse,
             status_code=status.HTTP_201_CREATED)
async def create_label(task_id: int, payload: LabelCreate,
                       request: Request,
                       db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    # Ensure task exists and user can edit it
    t = await _assert_can_edit_task(db, task_id, user)

    # Reject duplicate names within the task
    dup = await db.execute(
        select(Label).where(Label.task_id == task_id, func.lower(Label.name) == payload.name.lower())
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Label name already exists in this task")

    label = Label(task_id=task_id, name=payload.name, color=payload.color)
    db.add(label)
    await db.flush()
    await audit(db, user=user, action="label.create",
                resource_type="label", resource_id=label.id,
                meta={"name": label.name}, request=request)
    await db.commit()
    await db.refresh(label)
    return label


@router.patch("/labels/{label_id}", response_model=LabelResponse)
async def update_label(label_id: int, payload: LabelUpdate,
                       db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    label = await _assert_can_edit(db, label_id, user)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(label, k, v)
    await db.commit()
    await db.refresh(label)
    return label


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label(label_id: int, request: Request, force: bool = False,
                       db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    """
    Refuses to delete if any annotations still use this label, unless force=true.
    force=true cascades and deletes those annotations (irreversible without DB backup).
    """
    label = await _assert_can_edit(db, label_id, user)

    count_res = await db.execute(
        select(func.count()).select_from(Annotation).where(Annotation.label_id == label_id)
    )
    count = count_res.scalar_one()

    if count > 0 and not force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{count} annotations use this label. Pass ?force=true to delete anyway."
        )

    if count > 0:
        await db.execute(delete(Annotation).where(Annotation.label_id == label_id))

    await audit(db, user=user, action="label.delete",
                resource_type="label", resource_id=label.id,
                meta={"name": label.name}, request=request)
    await db.delete(label)
    await db.commit()


@router.get("/labels/{label_id}/usage")
async def label_usage(label_id: int, db: AsyncSession = Depends(get_db)):
    """Used by the UI to warn the user before deleting."""
    count = (await db.execute(
        select(func.count()).select_from(Annotation).where(Annotation.label_id == label_id)
    )).scalar_one()
    return {"label_id": label_id, "annotation_count": count}