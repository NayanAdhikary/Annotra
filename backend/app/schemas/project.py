from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


VALID_PRIORITIES = {"low", "normal", "high", "urgent"}
VALID_STATUSES = {"annotation", "review", "completed", "archived"}


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
    completed_task_count: int = 0
    in_review_task_count: int = 0
    annotation_task_count: int = 0

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    name: str
    task_type: str = "image"
    priority: str = "normal"
    due_at: Optional[datetime] = None
    description: Optional[str] = None
    instructions: Optional[str] = None

    @field_validator("priority")
    @classmethod
    def check_priority(cls, v):
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of {VALID_PRIORITIES}")
        return v


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    priority: Optional[str] = None
    due_at: Optional[datetime] = None
    description: Optional[str] = None
    instructions: Optional[str] = None


class TaskResponse(BaseModel):
    id: int
    project_id: int
    project_name: Optional[str] = None
    name: str
    task_type: str
    status: str
    priority: str
    due_at: Optional[datetime]
    description: Optional[str]
    instructions: Optional[str]
    image_count: int = 0
    label_count: int = 0
    annotated_count: int = 0
    comment_count: int = 0
    open_comment_count: int = 0
    assignees: List[dict] = []
    archived_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    last_submitted_at: Optional[datetime] = None
    last_submitted_by: Optional[int] = None

    class Config:
        from_attributes = True


class TaskTransition(BaseModel):
    to_status: str

    @field_validator("to_status")
    @classmethod
    def check_status(cls, v):
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    frame: Optional[int] = None
    annotation_id: Optional[int] = None


class CommentUpdate(BaseModel):
    resolved: Optional[bool] = None
    body: Optional[str] = None


class CommentResponse(BaseModel):
    id: int
    task_id: int
    user_id: Optional[int]
    user_email: Optional[str]
    user_name: Optional[str]
    body: str
    frame: Optional[int]
    annotation_id: Optional[int]
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MyTaskRow(BaseModel):
    id: int
    project_id: int
    project_name: str
    name: str
    task_type: str
    status: str
    priority: str
    due_at: Optional[datetime]
    role: str  # "annotator" | "reviewer"
    image_count: int
    annotated_count: int
    open_comment_count: int
    created_at: datetime
    rejected_annotation_count: int = 0


class QualityRow(BaseModel):
    user_id: int
    user_email: str
    user_name: Optional[str]
    role: str
    annotated_count: int
    accepted_count: int
    rejected_count: int
    fixed_count: int
    pending_count: int
    acceptance_rate: float   # accepted / (accepted + rejected + fixed)
    avg_per_day_7d: float


class QualityReport(BaseModel):
    since: Optional[datetime]
    until: Optional[datetime]
    rows: List[QualityRow]