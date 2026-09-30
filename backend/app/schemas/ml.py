from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MLModelResponse(BaseModel):
    id: int
    name: str
    version: str
    kind: str
    class_names: List[str]
    description: Optional[str]
    is_active: bool
    file_size: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class InferenceRequest(BaseModel):
    model_id: int
    confidence: float = 0.25
    label_mapping: dict = {}


class InferenceJobResponse(BaseModel):
    id: int
    task_id: int
    model_id: int
    confidence: str
    label_mapping: dict
    status: str
    progress: Optional[str]
    error: Optional[str]
    stats: dict
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class LabelMappingSuggestion(BaseModel):
    model_id: int
    model_name: str
    model_classes: List[str]
    suggested_mapping: dict
    unmatched_classes: List[str]
