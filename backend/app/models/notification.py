from sqlalchemy import Column, BigInteger, Integer, String, ForeignKey, DateTime, func, Boolean, Text
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(50), nullable=False, index=True)
    #"task_assigned" | "task_submitted_for_review" | "review_completed" | "task_rejected"

    title = Column(String(225), nullable=False)
    body = Column(Text)
    link = Column(String(500))
    resource_type = Column(String(30))
    resource_id = Column(BigInteger)

    read_at = Column(DateTime(timezone=True), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)