from sqlalchemy import (
    Column, BigInteger, String, ForeignKey, DateTime, func, Text,
)
from app.core.database import Base

class AnnotationComment(Base):
    __tablename__ = "annotation_comments"

    id = Column(BigInteger, primary_key=True)
    annotation_id = Column(BigInteger, ForeignKey("annotations.id", ondelete="CASCADE"),nullable=False, index=True)

    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email = Column(String(255))
    user_name = Column(String(255))
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)