from fastapi import status
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tasks = relationship("Task", back_populates="project")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    task_type = Column(String(20), default="image") #image or video
    status = Column(String(20), default="annotation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="tasks")
    labels = relationship("Label", back_populates="task")

class Label(Base):
    __tablename__ = "labels"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#FF0000")

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