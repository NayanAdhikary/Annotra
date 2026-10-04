from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import UserRole, User
from app.models.task import Task, Project
from app.models.tool_config import ToolConfig, UserPreferences
from app.schemas.tool_config import (
    ToolConfigUpdate, ToolConfigResponse,
    UserPreferencesUpdate,
)
from app.services.tool_config import resolve_config, _row_to_dict, _get_project_config
from app.services.audit import audit
from app.routers.projects import _assert_project_access

router = APIRouter()


# ---------------- Project-level config ----------------

@router.get("/projects/{project_id}/tool-config", response_model=ToolConfigResponse)
async def get_project_config(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_project_access(db, project_id, user)
    cfg = await _get_project_config(db, project_id)
    await db.commit()
    return _row_to_dict(cfg)


@router.patch("/projects/{project_id}/tool-config", response_model=ToolConfigResponse)
async def update_project_config(
    project_id: int, payload: ToolConfigUpdate, request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _assert_project_access(db, project_id, user)
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not allowed")

    cfg = await _get_project_config(db, project_id)
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(cfg, k, v)

    if cfg.default_tool not in cfg.enabled_tools:
        cfg.default_tool = cfg.enabled_tools[0] if cfg.enabled_tools else "rectangle"

    await audit(db, user=user,
                action="tool_config.update_project",
                resource_type="project", resource_id=project_id,
                meta={"fields": list(changes.keys())}, request=request)
    await db.commit()
    await db.refresh(cfg)
    return _row_to_dict(cfg)


# ---------------- Task-level config ----------------

@router.get("/tasks/{task_id}/tool-config", response_model=ToolConfigResponse)
async def get_task_config(
    task_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404)
    await _assert_project_access(db, task.project_id, user)

    resolved = await resolve_config(db, task.project_id, task_id=task_id)
    return resolved


@router.patch("/tasks/{task_id}/tool-config", response_model=ToolConfigResponse)
async def update_task_config(
    task_id: int, payload: ToolConfigUpdate, request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404)
    project = await _assert_project_access(db, task.project_id, user)
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not allowed")

    cfg = (await db.execute(
        select(ToolConfig).where(ToolConfig.task_id == task_id)
    )).scalar_one_or_none()

    if cfg is None:
        org = await _get_project_config(db, task.project_id)
        cfg = ToolConfig(project_id=task.project_id, task_id=task_id, **_row_to_dict(org))
        db.add(cfg)

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(cfg, k, v)

    if cfg.default_tool not in cfg.enabled_tools:
        cfg.default_tool = cfg.enabled_tools[0] if cfg.enabled_tools else "rectangle"

    await audit(db, user=user,
                action="tool_config.update_task",
                resource_type="task", resource_id=task_id,
                meta={"fields": list(changes.keys())}, request=request)
    await db.commit()
    await db.refresh(cfg)
    return _row_to_dict(cfg)


@router.delete("/tasks/{task_id}/tool-config", status_code=204)
async def reset_task_config(
    task_id: int, request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404)
    project = await _assert_project_access(db, task.project_id, user)
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not allowed")

    cfg = (await db.execute(
        select(ToolConfig).where(ToolConfig.task_id == task_id)
    )).scalar_one_or_none()
    if cfg:
        await db.delete(cfg)
        await audit(db, user=user,
                    action="tool_config.reset_task",
                    resource_type="task", resource_id=task_id, request=request)
        await db.commit()


# ---------------- Effective config for the workspace ----------------

@router.get("/tasks/{task_id}/effective-tool-config",
            response_model=ToolConfigResponse)
async def effective_config(
    task_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404)
    # Check access by fetching task using existing rules
    from app.routers.projects import _assert_can_read_task
    await _assert_can_read_task(db, task_id, user)

    return await resolve_config(
        db, task.project_id, task_id=task_id, user_id=user.id,
    )


# ---------------- User preferences ----------------

@router.get("/projects/{project_id}/me/preferences")
async def get_my_prefs(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_project_access(db, project_id, user)
    prefs = (await db.execute(
        select(UserPreferences).where(
            UserPreferences.user_id == user.id,
            UserPreferences.project_id == project_id,
        )
    )).scalar_one_or_none()
    return {"overrides": (prefs.overrides if prefs else {}) or {}}


@router.put("/projects/{project_id}/me/preferences")
async def update_my_prefs(
    project_id: int,
    payload: UserPreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_project_access(db, project_id, user)
    prefs = (await db.execute(
        select(UserPreferences).where(
            UserPreferences.user_id == user.id,
            UserPreferences.project_id == project_id,
        )
    )).scalar_one_or_none()

    if prefs is None:
        prefs = UserPreferences(
            user_id=user.id,
            project_id=project_id,
            overrides=payload.overrides,
        )
        db.add(prefs)
    else:
        prefs.overrides = payload.overrides

    await db.commit()
    return {"overrides": prefs.overrides}


@router.delete("/projects/{project_id}/me/preferences", status_code=204)
async def reset_my_prefs(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_project_access(db, project_id, user)
    prefs = (await db.execute(
        select(UserPreferences).where(
            UserPreferences.user_id == user.id,
            UserPreferences.project_id == project_id,
        )
    )).scalar_one_or_none()
    if prefs:
        await db.delete(prefs)
        await db.commit()