from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tool_config import ToolConfig, UserPreferences


CONFIG_FIELDS = [
    "enabled_tools", "default_tool",
    "brush_size_default", "brush_size_min", "brush_size_max",
    "default_zoom_mode",
    "snap_to_grid", "snap_to_vertex", "grid_size",
    "auto_advance_on_complete", "auto_select_new_shape",
    "confirm_bulk_delete", "show_coordinates", "show_shape_count",
    "shortcuts",
]


def row_to_dict(cfg: ToolConfig) -> dict[str, Any]:
    return {f: getattr(cfg, f) for f in CONFIG_FIELDS}


async def get_or_create_org_config(db: AsyncSession, org_id: int) -> ToolConfig:
    """The org default — project_id NULL."""
    cfg = (await db.execute(
        select(ToolConfig).where(
            ToolConfig.org_id == org_id,
            ToolConfig.project_id.is_(None),
        )
    )).scalar_one_or_none()
    if cfg is None:
        cfg = ToolConfig(org_id=org_id, project_id=None)
        db.add(cfg)
        await db.flush()
    return cfg


async def get_project_config(
    db: AsyncSession, org_id: int, project_id: int,
) -> ToolConfig | None:
    return (await db.execute(
        select(ToolConfig).where(
            ToolConfig.org_id == org_id,
            ToolConfig.project_id == project_id,
        )
    )).scalar_one_or_none()


async def resolve_config(
    db: AsyncSession,
    org_id: int,
    project_id: int | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    """
    WARNING: Never let the config resolution order drift. It's always: org → project → user. 
    Higher layers override lower ones. Shortcuts merge across layers; everything else replaces.
    
    Resolution chain, lowest to highest priority:
      1. Org default (project_id IS NULL)
      2. Project override (if the project has one)
      3. User preferences (per-org overrides)
    """
    base = row_to_dict(await get_or_create_org_config(db, org_id))

    if project_id is not None:
        project_cfg = await get_project_config(db, org_id, project_id)
        if project_cfg:
            for k, v in row_to_dict(project_cfg).items():
                if k == "shortcuts" and isinstance(v, dict):
                    base[k] = {**base.get("shortcuts", {}), **v}
                else:
                    base[k] = v

    if user_id:
        prefs = (await db.execute(
            select(UserPreferences).where(
                UserPreferences.user_id == user_id,
                UserPreferences.org_id == org_id,
            )
        )).scalar_one_or_none()

        if prefs and prefs.overrides:
            for k, v in prefs.overrides.items():
                if k in CONFIG_FIELDS:
                    if k == "shortcuts" and isinstance(v, dict):
                        base[k] = {**base.get("shortcuts", {}), **v}
                    else:
                        base[k] = v

    return base
