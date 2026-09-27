from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExportRequest(BaseModel):
    format: str       # "coco" | "yolo" | "voc" | "cvat"
    include_images: bool = True


class ExportJobResponse(BaseModel):
    id: int
    task_id: int
    format: str
    include_images: bool
    status: str
    progress: Optional[str]
    error: Optional[str]
    file_size: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ImportRequest(BaseModel):
    format: Optional[str] = None         # auto-detected if omitted
    label_mapping: dict = {}             # {"external_name": task_label_id}
    as_preannotations: bool = False


class ImportJobResponse(BaseModel):
    id: int
    task_id: int
    format: str
    status: str
    progress: Optional[str]
    error: Optional[str]
    stats: Optional[dict]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DetectImportRequest(BaseModel):
    """Preview unknown labels in a dataset before import."""
    format: Optional[str] = None


class DetectImportResponse(BaseModel):
    detected_format: str
    external_labels: list[str]
    image_count: int
    annotation_count: int
