from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict


VALID_TOOLS = {
    "rectangle", "polygon", "polyline", "points", "brush", "eraser",
    "cuboid", "skeleton",
}
VALID_GROUPS = {"shapes", "draw", "select", "advanced"}


class ToolConfigUpdate(BaseModel):
    enabled_tools: Optional[List[str]] = None
    default_tool: Optional[str] = None
    enabled_groups: Optional[List[str]] = None
    brush_size_default: Optional[int] = Field(default=None, ge=1, le=500)
    brush_size_min: Optional[int] = Field(default=None, ge=1, le=100)
    brush_size_max: Optional[int] = Field(default=None, ge=5, le=500)
    default_zoom_mode: Optional[str] = None
    snap_to_grid: Optional[bool] = None
    snap_to_vertex: Optional[bool] = None
    snap_to_edge: Optional[bool] = None
    grid_size: Optional[int] = Field(default=None, ge=2, le=200)
    auto_advance_on_complete: Optional[bool] = None
    auto_select_new_shape: Optional[bool] = None
    auto_open_label_picker: Optional[bool] = None
    confirm_bulk_delete: Optional[bool] = None
    show_coordinates: Optional[bool] = None
    show_shape_count: Optional[bool] = None
    show_minimap: Optional[bool] = None
    shortcuts: Optional[Dict[str, str]] = None
    undo_history_depth: Optional[int] = Field(default=None, ge=10, le=1000)
    autosave_debounce_ms: Optional[int] = Field(default=None, ge=100, le=5000)

    @field_validator("enabled_tools")
    @classmethod
    def check_tools(cls, v):
        if v is None:
            return v
        bad = [x for x in v if x not in VALID_TOOLS]
        if bad:
            raise ValueError(f"Unknown tools: {bad}")
        if not v:
            raise ValueError("At least one tool must be enabled")
        return v

    @field_validator("default_tool")
    @classmethod
    def check_default(cls, v):
        if v is not None and v not in VALID_TOOLS:
            raise ValueError(f"Unknown default tool: {v}")
        return v

    @field_validator("enabled_groups")
    @classmethod
    def check_groups(cls, v):
        if v is None:
            return v
        bad = [x for x in v if x not in VALID_GROUPS]
        if bad:
            raise ValueError(f"Unknown groups: {bad}")
        return v

    @field_validator("default_zoom_mode")
    @classmethod
    def check_zoom(cls, v):
        if v is not None and v not in ("fit", "100", "last"):
            raise ValueError("zoom mode must be fit, 100, or last")
        return v


class ToolConfigResponse(ToolConfigUpdate):
    """Every field is always populated in the response."""
    pass


class UserPreferencesUpdate(BaseModel):
    overrides: Dict[str, object] = Field(default_factory=dict)

    @field_validator("overrides")
    @classmethod
    def check_keys(cls, v):
        from app.services.tool_config import CONFIG_FIELDS
        bad = [k for k in v.keys() if k not in CONFIG_FIELDS]
        if bad:
            raise ValueError(f"Unknown override keys: {bad}")
        return v