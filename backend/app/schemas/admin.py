from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime


class AdminCreateUser(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = None
    role: str = "annotator"


class AdminUpdateUser(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AdminResetPassword(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class AdminUserDetail(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    role: str
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    # Aggregates
    project_count: int = 0
    task_count: int = 0
    annotation_count: int = 0
    active_sessions: int = 0


class SystemStats(BaseModel):
    total_users: int
    active_users_7d: int
    total_projects: int
    total_tasks: int
    total_images: int
    total_videos: int
    total_annotations: int
    annotations_today: int
    storage_bytes: int
    disk_free_bytes: int


class AuditLogEntry(BaseModel):
    id: int
    user_id: Optional[int]
    user_email: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    ip_address: Optional[str]
    meta: dict
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogPage(BaseModel):
    total: int
    items: List[AuditLogEntry]


class HealthReport(BaseModel):
    database: bool
    redis: bool
    storage_writable: bool
    celery_workers: int
    pending_jobs: int
    versions: dict
