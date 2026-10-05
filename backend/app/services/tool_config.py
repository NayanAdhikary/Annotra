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
    cfg = (await db.execute(
        select(ToolConfig).where(ToolConfig.org_id == org_id)
    )).scalar_one_or_none()
    if cfg is None:
        cfg = ToolConfig(org_id=org_id)
        db.add(cfg)
        await db.flush()
    return cfg


async def resolve_config(
    db: AsyncSession, org_id: int, user_id: int | None = None,
) -> dict[str, Any]:
    base = row_to_dict(await get_or_create_org_config(db, org_id))

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
