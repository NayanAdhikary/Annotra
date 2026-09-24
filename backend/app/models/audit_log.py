from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, JSON, Index
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True, index=True)
    user_email    = Column(String(255), nullable=True, index=True)  # snapshot
    action        = Column(String(100), nullable=False, index=True)  # "user.role_change"
    resource_type = Column(String(50), nullable=True, index=True)    # "user", "project", "task", "annotation"
    resource_id   = Column(Integer, nullable=True, index=True)
    ip_address    = Column(String(45))
    user_agent    = Column(String(500))
    meta          = Column(JSON, default=dict)                       # arbitrary context
    created_at    = Column(DateTime(timezone=True), server_default=func.now(),
                           index=True)

    __table_args__ = (
        Index("ix_audit_user_created", "user_id", "created_at"),
        Index("ix_audit_resource", "resource_type", "resource_id"),
    )
