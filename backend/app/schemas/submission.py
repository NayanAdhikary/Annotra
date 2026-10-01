from pydantic import BaseModel, Field
from typing import List, Optional

class SubmissionWarning(BaseModel):
    kind: str
    message: str
    count: int
    detail: Optional[str] = None

class SubmissionPreflight(BaseModel):
    total_images: int
    completed_images: int
    skipped_images: int
    pending_images: int
    total_annotations: int
    warnings: List[SubmissionWarning]
    can_submit: bool
    blocks_submission: bool

class SubmissionRequest(BaseModel):
    force: bool = False
    note: Optional[str] = Field(default=None, max_length=1000)

SKIP_REASONS = [
    "blurry",
    "no_objects",
    "wrong_category",
    "duplicate_of_previous",
    "cropped_too_tight",
    "needs_supervisor",
    "other",
]
