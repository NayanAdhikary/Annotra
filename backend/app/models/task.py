from fastapi import status
from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, DateTime, func, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    project_id    = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    name          = Column(String(255), nullable=False)
    task_type     = Column(String(20), default="image")  # "image" | "video"
    status        = Column(String(20), default="annotation", nullable=False, index=True)
    # "annotation" | "review" | "completed" | "archived"

    priority      = Column(String(20), default="normal", nullable=False, index=True)
    # "low" | "normal" | "high" | "urgent"

    due_at        = Column(DateTime(timezone=True), nullable=True, index=True)
    description   = Column(Text, nullable=True)          # short summary
    instructions  = Column(Text, nullable=True)          # markdown guidelines

    archived_at   = Column(DateTime(timezone=True), nullable=True)
    completed_at  = Column(DateTime(timezone=True), nullable=True)

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    last_submitted_at = Column(DateTime(timezone=True), nullable=True)
    last_submitted_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    project = relationship("Project", back_populates="tasks")
    labels  = relationship("Label", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")


class TaskComment(Base):
    __tablename__ = "task_comments"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    task_id        = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                            nullable=True, index=True)
    user_email     = Column(String(255))   # snapshot
    user_name      = Column(String(255))
    body           = Column(Text, nullable=False)
    frame          = Column(Integer, nullable=True)      # optional: attached to a frame
    annotation_id  = Column(Integer, nullable=True)   # optional: attached to an annotation
    resolved       = Column(Boolean, default=False, nullable=False, index=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    task = relationship("Task", back_populates="comments")

class Label(Base):
    __tablename__ = "labels"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#FF0000")
    attributes = Column(JSON, default=list, nullable=False)

    task = relationship("Task", back_populates="labels")

class ImageAsset(Base):
    __tablename__ = "image_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    width = Column(Integer)
    height = Column(Integer)
    storage_path = Column(String(1000), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())