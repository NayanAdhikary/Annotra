from sqlalchemy import Column, BigInteger, Integer, String, ForeignKey, DateTime, func, UniqueConstraint
from app.core.database import Base

class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    task_id    = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    user_id    = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    role       = Column(String(20), nullable=False)  # "annotator" | "reviewer"
    assigned_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"))
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("task_id", "user_id", "role", name="uq_task_user_role"),
    )
    