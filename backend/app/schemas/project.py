from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    task_count: int = 0
    image_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    name: str
    task_type: str = "image"


class TaskResponse(BaseModel):
    id: int
    project_id: int
    name: str
    task_type: str
    status: str
    image_count: int = 0
    label_count: int = 0
    annotated_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True