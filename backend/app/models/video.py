from sqlalchemy import (
    Column, BigInteger, String, ForeignKey, DateTime, func, Integer, Float,
)
from app.core.database import Base


class VideoAsset(Base):
    __tablename__ = "video_assets"

    id                 = Column(BigInteger, primary_key=True)
    task_id            = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"),
                                nullable=False, index=True)
    filename           = Column(String(500), nullable=False)
    storage_path       = Column(String(1000), nullable=False)
    frames_dir         = Column(String(1000), nullable=False)

    duration_sec       = Column(Float, default=0.0)
    fps                = Column(Float, default=0.0)
    total_frames       = Column(Integer, default=0)
    width              = Column(Integer, default=0)
    height             = Column(Integer, default=0)

    extraction_status  = Column(String(20), default="pending", nullable=False, index=True)
    # "pending" | "running" | "done" | "failed"
    extraction_error   = Column(String(1000))
    extraction_job_id  = Column(String(100))

    created_at         = Column(DateTime(timezone=True), server_default=func.now())