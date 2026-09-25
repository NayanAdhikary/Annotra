from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Boolean, JSON, BigInteger
from app.core.database import Base

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    image_id = Column(Integer, ForeignKey("image_assets.id"), nullable=True, index=True)
    video_id = Column(Integer, nullable=True)
    frame = Column(Integer, default=0)

    label_id = Column(Integer, ForeignKey("labels.id"), nullable=False)
    shape_type = Column(String(20), nullable=False)  # rectangle, polygon, polyline, points, mask
    points = Column(JSON, nullable=False)              # [x1,y1,x2,y2] or [x1,y1,x2,y2,...]
    attributes = Column(JSON, default=list)
    occluded = Column(Boolean, default=False)
    source = Column(String(10), default="manual")
    group_id = Column(Integer, default=0)
    
    review_status = Column(String(20), default="pending", nullable=False, index=True)
    # "pending" | "accepted" | "rejected" | "fixed"
    reviewed_by   = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at   = Column(DateTime(timezone=True), nullable=True)
    review_comment = Column(String(1000), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())