from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.tool_config import ToolConfig, UserPreferences


# Fields that come from ToolConfig
CONFIG_FIELDS = [
    "enabled_tools", "default_tool", "enabled_groups",
    "brush_size_default", "brush_size_min", "brush_size_max",
    "default_zoom_mode",
    "snap_to_grid", "snap_to_vertex", "snap_to_edge", "grid_size",
    "auto_advance_on_complete", "auto_select_new_shape", "auto_open_label_picker",
    "confirm_bulk_delete",
    "show_coordinates", "show_shape_count", "show_minimap",
    "shortcuts", "undo_history_depth", "autosave_debounce_ms",
]


def _row_to_dict(cfg: ToolConfig) -> dict[str, Any]:
    return {f: getattr(cfg, f) for f in CONFIG_FIELDS}


async def _get_project_config(db: AsyncSession, project_id: int) -> ToolConfig:
    cfg = (await db.execute(
        select(ToolConfig).where(
            ToolConfig.project_id == project_id,
            ToolConfig.task_id.is_(None),
        )
    )).scalar_one_or_none()

    if cfg is None:
        # Auto-create project default on first access
        cfg = ToolConfig(project_id=project_id, task_id=None)
        db.add(cfg)
        await db.flush()
    return cfg


async def _get_task_config(db: AsyncSession, task_id: int) -> ToolConfig | None:
    return (await db.execute(
        select(ToolConfig).where(ToolConfig.task_id == task_id)
    )).scalar_one_or_none()


async def resolve_config(
    db: AsyncSession,
    project_id: int,
    task_id: int | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    """
    Resolve the effective tool config:
      1. project default
      2. Task override (if the task has its own config)
      3. User preferences (per-project overrides)
    """
    base = _row_to_dict(await _get_project_config(db, project_id))

    if task_id:
        task_cfg = await _get_task_config(db, task_id)
        if task_cfg:
            task_dict = _row_to_dict(task_cfg)
            # Task override replaces everything except for shortcuts, which merge
            for k, v in task_dict.items():
                if k == "shortcuts" and isinstance(v, dict):
                    base[k] = {**base.get("shortcuts", {}), **v}
                else:
                    base[k] = v

    if user_id:
        prefs = (await db.execute(
            select(UserPreferences).where(
                UserPreferences.user_id == user_id,
                UserPreferences.project_id == project_id,
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
