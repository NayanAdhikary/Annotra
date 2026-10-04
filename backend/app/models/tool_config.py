from sqlalchemy import (
    Column, BigInteger, String, ForeignKey, DateTime, func, Boolean, Integer, JSON,
    UniqueConstraint,
)
from app.core.database import Base


class ToolConfig(Base):
    """Per-project or per-task tool configuration. task_id NULL = project default."""
    __tablename__ = "tool_configs"

    id       = Column(Integer, primary_key=True, autoincrement=True)
    project_id   = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    task_id  = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"),
                      nullable=True, index=True)

    # Enabled tools and default
    enabled_tools = Column(JSON, default=lambda: [
        "rectangle", "polygon", "polyline", "points", "brush", "eraser"
    ])
    default_tool = Column(String(20), default="rectangle")
    enabled_groups = Column(JSON, default=lambda: [
        "shapes", "draw", "select"
    ])
    # groups: "shapes" (rect/poly/line/points), "draw" (brush/eraser), "select", "advanced"

    # Brush defaults
    brush_size_default = Column(Integer, default=30)
    brush_size_min     = Column(Integer, default=5)
    brush_size_max     = Column(Integer, default=200)

    # Zoom and view
    default_zoom_mode  = Column(String(20), default="fit")
    # "fit" | "100" | "last"

    # Snapping
    snap_to_grid    = Column(Boolean, default=False)
    snap_to_vertex  = Column(Boolean, default=True)
    snap_to_edge    = Column(Boolean, default=False)
    grid_size       = Column(Integer, default=20)

    # Workflow behavior
    auto_advance_on_complete = Column(Boolean, default=True)
    auto_select_new_shape    = Column(Boolean, default=True)
    auto_open_label_picker   = Column(Boolean, default=False)
    confirm_bulk_delete      = Column(Boolean, default=True)
    show_coordinates         = Column(Boolean, default=True)
    show_shape_count         = Column(Boolean, default=True)
    show_minimap             = Column(Boolean, default=False)

    # Keyboard shortcuts
    shortcuts = Column(JSON, default=lambda: {
        "select":    "V",
        "rectangle": "R",
        "polygon":   "P",
        "polyline":  "L",
        "points":    "K",
        "brush":     "B",
        "eraser":    "E",
        "pan":       "Space",
        "undo":      "Ctrl+Z",
        "redo":      "Ctrl+Shift+Z",
        "delete":    "Delete",
        "next_image":  "ArrowRight",
        "prev_image":  "ArrowLeft",
        "mark_done":   "Enter",
        "skip_image":  "S",
    })

    # Fine-grained controls
    undo_history_depth = Column(Integer, default=100)
    autosave_debounce_ms = Column(Integer, default=400)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("project_id", "task_id", name="uq_tool_config_project_task"),
    )


class UserPreferences(Base):
    """Per-user overrides. Layered on top of the effective tool config."""
    __tablename__ = "user_preferences"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    project_id  = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    # Any subset of ToolConfig fields — only what the user has overridden
    overrides = Column(JSON, default=dict)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "project_id", name="uq_user_prefs_project"),
    )

