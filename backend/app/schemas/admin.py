from enum import StrEnum
from sqlalchemy.sql.operators import is_not_distinct_from
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


class AssignTaskRequest(BaseModel):
    user_id: int
    role: str = "annotator" #annotator" | "reviewer"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("annotator", "reviewer"):
            raise ValueError("role must be 'annotator' or 'reviewer")
        return v

class TaskAssignmentResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    role: str
    assigned_at: datetime
    #Denormalized for the UI
    user_email: str | None = None
    user_name: str | None = None

    class Config:
        from_attrinutes = True

class ReviewAction(BaseModel):
    annotation_ids: list[int]
    action: str # "accept" | "reject" | "fix"
    comment: str | None = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v):
        if v not in ("accept", "reject", "fix"):
            raise ValueError("action must be accept, reject, or fix")
        return v

class AdminProjectRow(BaseModel):
    id: int
    name: str
    description: str | None
    owner_id: int
    owner_email: str | None
    owner_name: str | None
    task_count: int
    image_count: int
    annotation_count: int
    created_at: datetime

class AdminTaskRow(BaseModel):
    id: int
    project_id: int
    project_name: str
    name: str
    task_type: str | None = None
    status: str
    image_count: int
    label_count: int
    annotated_count: int
    reviewer_count: int
    annotator_count: int
    assignees: list[dict] # [{user_id, role, name, email}]
    created_at: datetime

class ConfigEntry(BaseModel):
    key: str
    value: Any
    category: str
    description: str | None = None
    updated_at: datetime
    update_by_email: str | None = None

class ConfigPatch(BaseModel):
    entries: list[dict] # [{Key, value}]


class ApiKeyCreate(BaseModel):
    name: str
    expires_in_days: int | None = None

class ApiKeyResponse(BaseModel):
    id: int
    name: str
    prefix: str
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None

class ApiKeyCreated(ApiKeyResponse):
    #Only retured once, at creation time
    raw_key: str


class BulkUserCreate(BaseModel):
    users: list[AdminCreateUser]

class AnalyticsPoint(BaseModel):
    date: str
    annotations: int
    active_users: int
    images_uploaded: int

class AnalyticsSeries(BaseModel):
    days: int
    points: list[AnalyticsPoint]

class ImpersonateResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    impersonated_email: str

class NotificationCreate(BaseModel):
    title: str
    message: str
    severity: str = "info" # "info" | "warning" | "critical"
    expires_in_hours: int = 24

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    created_at: datetime
    expires_at: datetime | None
    created_by_email: str | None
    read: bool = False
