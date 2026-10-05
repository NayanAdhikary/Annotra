from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List, Dict

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task import Project
from app.models.tool_config import UserPreferences, ToolConfig
from app.services.tool_config import (
    resolve_config, row_to_dict, get_or_create_org_config, get_project_config, CONFIG_FIELDS,
)

router = APIRouter()

VALID_TOOLS = {"rectangle", "polygon", "polyline", "points", "brush", "eraser"}

class ConfigUpdate(BaseModel):
    enabled_tools: Optional[List[str]] = None
    default_tool: Optional[str] = None
    brush_size_default: Optional[int] = None
    brush_size_min: Optional[int] = None
    brush_size_max: Optional[int] = None
    default_zoom_mode: Optional[str] = None
    snap_to_grid: Optional[bool] = None
    snap_to_vertex: Optional[bool] = None
    grid_size: Optional[int] = None
    auto_advance_on_complete: Optional[bool] = None
    auto_select_new_shape: Optional[bool] = None
    confirm_bulk_delete: Optional[bool] = None
    show_coordinates: Optional[bool] = None
    show_shape_count: Optional[bool] = None
    shortcuts: Optional[Dict[str, str]] = None

@router.get("/orgs/{org_id}/tool-config")
async def get_org_config(
    org_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if org_id != 1:
        raise HTTPException(404, "Org not found")
    cfg = await get_or_create_org_config(db, org_id)
    await db.commit()
    return row_to_dict(cfg)

@router.patch("/orgs/{org_id}/tool-config")
async def update_org_config(
    org_id: int, payload: ConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if org_id != 1:
        raise HTTPException(404, "Org not found")
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Not allowed")

    cfg = await get_or_create_org_config(db, org_id)
    changes = payload.model_dump(exclude_unset=True)

    if "enabled_tools" in changes:
        bad = [t for t in changes["enabled_tools"] if t not in VALID_TOOLS]
        if bad:
            raise HTTPException(422, f"Unknown tools: {bad}")
        if not changes["enabled_tools"]:
            raise HTTPException(422, "At least one tool must be enabled")

    for k, v in changes.items():
        setattr(cfg, k, v)

    if cfg.default_tool not in cfg.enabled_tools:
        cfg.default_tool = cfg.enabled_tools[0]

    await db.commit()
    await db.refresh(cfg)
    return row_to_dict(cfg)

@router.get("/orgs/{org_id}/effective-config")
async def effective_config(
    org_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if org_id != 1:
        raise HTTPException(404, "Org not found")
    return await resolve_config(db, org_id, user_id=user.id)

@router.get("/me/preferences")
async def get_prefs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = 1
    prefs = (await db.execute(
        select(UserPreferences).where(
            UserPreferences.user_id == user.id,
            UserPreferences.org_id == org_id,
        )
    )).scalar_one_or_none()
    return {"overrides": prefs.overrides if prefs else {}}

@router.put("/me/preferences")
async def update_prefs(
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = 1
    overrides = payload.get("overrides", {})
    bad = [k for k in overrides.keys() if k not in CONFIG_FIELDS]
    if bad:
        raise HTTPException(422, f"Unknown keys: {bad}")

    prefs = (await db.execute(
        select(UserPreferences).where(
            UserPreferences.user_id == user.id,
            UserPreferences.org_id == org_id,
        )
    )).scalar_one_or_none()

    if prefs is None:
        prefs = UserPreferences(
            user_id=user.id, org_id=org_id,
            overrides=overrides,
        )
        db.add(prefs)
    else:
        prefs.overrides = overrides

    await db.commit()
    return {"overrides": overrides}

@router.delete("/me/preferences", status_code=204)
async def reset_prefs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = 1
    prefs = (await db.execute(
        select(UserPreferences).where(
            UserPreferences.user_id == user.id,
            UserPreferences.org_id == org_id,
        )
    )).scalar_one_or_none()
    if prefs:
        await db.delete(prefs)
        await db.commit()


# ---------------- Project-scoped config ----------------

@router.get("/projects/{project_id}/tool-config")
async def get_project_config_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the *effective* config for this project: org defaults merged
    with any project override. Does NOT include user preferences — that's
    for the workspace's effective-config endpoint.
    """
    org_id = 1
    project = await db.get(Project, project_id)
    if project is None or project.org_id != org_id:
        raise HTTPException(404)

    resolved = await resolve_config(db, org_id, project_id=project_id)
    has_override = (await get_project_config(db, org_id, project_id)) is not None

    return {**resolved, "_has_project_override": has_override}


@router.patch("/projects/{project_id}/tool-config")
async def update_project_config(
    project_id: int, payload: ConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = 1
    project = await db.get(Project, project_id)
    if project is None or project.org_id != org_id:
        raise HTTPException(404)
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Not allowed")

    cfg = await get_project_config(db, org_id, project_id)

    if cfg is None:
        # First override — seed from org defaults
        org_cfg = await get_or_create_org_config(db, org_id)
        cfg = ToolConfig(
            org_id=org_id,
            project_id=project_id,
            **row_to_dict(org_cfg),
        )
        db.add(cfg)

    changes = payload.model_dump(exclude_unset=True)

    if "enabled_tools" in changes:
        bad = [t for t in changes["enabled_tools"] if t not in VALID_TOOLS]
        if bad:
            raise HTTPException(422, f"Unknown tools: {bad}")
        if not changes["enabled_tools"]:
            raise HTTPException(422, "At least one tool must be enabled")

    for k, v in changes.items():
        setattr(cfg, k, v)

    if cfg.default_tool not in cfg.enabled_tools:
        cfg.default_tool = cfg.enabled_tools[0]

    await db.commit()
    await db.refresh(cfg)
    return row_to_dict(cfg)


@router.delete("/projects/{project_id}/tool-config", status_code=204)
async def reset_project_config(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the project override — inherit org defaults again."""
    org_id = 1
    project = await db.get(Project, project_id)
    if project is None or project.org_id != org_id:
        raise HTTPException(404)
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Not allowed")

    cfg = await get_project_config(db, org_id, project_id)
    if cfg:
        await db.delete(cfg)
        await db.commit()


# ---------------- Update effective-config to accept project ----------------

@router.get("/projects/{project_id}/effective-config")
async def project_effective_config(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Merged config for the current user inside this project:
    org → project → user.
    """
    org_id = 1
    project = await db.get(Project, project_id)
    if project is None or project.org_id != org_id:
        raise HTTPException(404)

    return await resolve_config(
        db,
        org_id,
        project_id=project_id,
        user_id=user.id,
    )