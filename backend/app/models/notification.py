from sqlalchemy import Column, BigInteger, String, ForeignKey, DateTime, func, Text
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id            = Column(BigInteger, primary_key=True)
    user_id       = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    project_id    = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"),
                           nullable=True, index=True)
    kind          = Column(String(50), nullable=False, index=True)
    title         = Column(String(255), nullable=False)
    body          = Column(Text)
    link          = Column(String(500))
    resource_type = Column(String(30))
    resource_id   = Column(BigInteger)
    read_at       = Column(DateTime(timezone=True), index=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), index=True)