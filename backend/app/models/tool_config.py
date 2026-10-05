from sqlalchemy import (
    Column, BigInteger, String, ForeignKey, DateTime, func,
    Boolean, Integer, JSON, UniqueConstraint,
)
from app.core.database import Base


class ToolConfig(Base):
    __tablename__ = "tool_configs"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    org_id     = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"),
                        nullable=True, index=True)
    # NULL = org default. Non-NULL = project override.
    enabled_tools = Column(JSON, default=lambda: [
        "rectangle", "polygon", "polyline", "points", "brush", "eraser"
    ])
    default_tool       = Column(String(20), default="rectangle")
    brush_size_default = Column(Integer, default=30)
    brush_size_min     = Column(Integer, default=5)
    brush_size_max     = Column(Integer, default=200)
    default_zoom_mode  = Column(String(20), default="fit")
    snap_to_grid       = Column(Boolean, default=False)
    snap_to_vertex     = Column(Boolean, default=True)
    grid_size          = Column(Integer, default=20)
    auto_advance_on_complete = Column(Boolean, default=True)
    auto_select_new_shape    = Column(Boolean, default=True)
    confirm_bulk_delete      = Column(Boolean, default=True)
    show_coordinates         = Column(Boolean, default=True)
    show_shape_count         = Column(Boolean, default=True)
    shortcuts = Column(JSON, default=lambda: {
        "select": "V", "rectangle": "R", "polygon": "P",
        "polyline": "L", "points": "K", "brush": "B", "eraser": "E",
    })
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("org_id", "project_id", name="uq_tool_config_org_project"),
    )

class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    org_id  = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    overrides = Column(JSON, default=dict, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_user_prefs_org"),
    )
