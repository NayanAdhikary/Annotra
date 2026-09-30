from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


VALID_REVIEW_STATUSES = {"pending", "accepted", "rejected", "fixed"}
VALID_REJECT_REASONS = {
    "wrong_label", "bad_geometry", "outside_object",
    "missing_occlusion", "duplicate", "other",
}


class ReviewSingleRequest(BaseModel):
    status: str
    reason: Optional[str] = None
    comment: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("status")
    @classmethod
    def check_status(cls, v):
        if v not in VALID_REVIEW_STATUSES:
            raise ValueError(f"status must be one of {VALID_REVIEW_STATUSES}")
        return v

    @field_validator("reason")
    @classmethod
    def check_reason(cls, v):
        if v is not None and v not in VALID_REJECT_REASONS:
            raise ValueError(f"reason must be one of {VALID_REJECT_REASONS}")
        return v


class ReviewQueueStats(BaseModel):
    pending: int
    accepted: int
    rejected: int
    fixed: int
    total: int
    percent_reviewed: float


class ReviewQueueResponse(BaseModel):
    stats: ReviewQueueStats
    pending_ids: List[int]
    rejected_ids: List[int]


class AnnotationCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class AnnotationCommentResponse(BaseModel):
    id: int
    annotation_id: int
    user_id: Optional[int]
    user_email: Optional[str]
    user_name: Optional[str]
    body: str
    created_at: datetime

    class Config:
        from_attributes = True