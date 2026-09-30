from sqlalchemy import (
    Column, BigInteger, String, ForeignKey, DateTime, func, Text, Boolean,
)
from app.core.database import Base


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id              = Column(BigInteger, primary_key=True)
    task_id         = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    user_id         = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"),
                             nullable=True)
    format          = Column(String(30), nullable=False)   # "coco" | "yolo" | "voc" | "cvat"
    include_images  = Column(Boolean, default=True, nullable=False)
    status          = Column(String(20), default="pending", nullable=False, index=True)
    # "pending" | "running" | "done" | "failed"
    progress        = Column(String(200))
    error           = Column(Text)
    file_path       = Column(String(1000))
    file_size       = Column(BigInteger)
    expires_at      = Column(DateTime(timezone=True))

    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at    = Column(DateTime(timezone=True))


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id                = Column(BigInteger, primary_key=True)
    task_id           = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"),
                               nullable=False, index=True)
    user_id           = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"),
                               nullable=True)
    format            = Column(String(30), nullable=False)
    source_path       = Column(String(1000), nullable=False)
    label_mapping     = Column(Text)   # JSON {"external_label": task_label_id}
    as_preannotations = Column(Boolean, default=False, nullable=False)

    status            = Column(String(20), default="pending", nullable=False, index=True)
    progress          = Column(String(200))
    error             = Column(Text)
    stats             = Column(Text)   # JSON summary

    created_at        = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at      = Column(DateTime(timezone=True))