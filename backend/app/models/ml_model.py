from sqlalchemy import (
    Column, BigInteger, String, DateTime, func, Boolean, JSON, ForeignKey, Text,
)
from app.core.database import Base


class MLModel(Base):
    __tablename__ = "ml_models"

    id           = Column(BigInteger, primary_key=True)
    name         = Column(String(200), nullable=False)
    version      = Column(String(50), default="1.0")
    kind         = Column(String(30), nullable=False, index=True)
    # "yolov8_det" | "yolov8_seg"

    file_path    = Column(String(1000), nullable=False)
    file_size    = Column(BigInteger)
    class_names  = Column(JSON, default=list)
    description  = Column(Text)
    is_active    = Column(Boolean, default=True, nullable=False, index=True)

    uploaded_by  = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"),
                          nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


class InferenceJob(Base):
    __tablename__ = "inference_jobs"

    id                = Column(BigInteger, primary_key=True)
    task_id           = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"),
                               nullable=False, index=True)
    model_id          = Column(BigInteger, ForeignKey("ml_models.id", ondelete="CASCADE"),
                               nullable=False)
    user_id           = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"),
                               nullable=True)

    confidence        = Column(String(10), default="0.25")
    label_mapping     = Column(JSON, default=dict)   # {"person": 3, "car": 7}

    status            = Column(String(20), default="pending", nullable=False, index=True)
    progress          = Column(String(200))
    error             = Column(Text)
    stats             = Column(JSON, default=dict)

    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    completed_at      = Column(DateTime(timezone=True))
