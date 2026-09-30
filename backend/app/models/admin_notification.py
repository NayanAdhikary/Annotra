from sqlalchemy import Column, BigInteger, Integer, String, DateTime, ForeignKey, func, Boolean
from app.core.database import Base

class AdminNotification(Base):
    __tablename__ = "admin_notifications"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    message = Column(String(2000), nullable=False)
    severity = Column(String(20), default="info")
    created_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))