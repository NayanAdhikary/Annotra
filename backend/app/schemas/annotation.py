from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any, Literal
from datetime import datetime
from enum import Enum


class ShapeType(str, Enum):
    RECTANGLE = "rectangle"
    POLYGON = "polygon"
    POLYLINE = "polyline"
    POINTS = "points"
    MASK = "mask"


# Minimum coordinate counts per shape type
MIN_COORDS = {
    ShapeType.RECTANGLE: 4,   # x1,y1,x2,y2
    ShapeType.POLYGON: 6,     # 3 vertices minimum
    ShapeType.POLYLINE: 4,    # 2 vertices minimum
    ShapeType.POINTS: 2,      # 1 keypoint minimum
    ShapeType.MASK: 1,        # 1 RLE string
}


class AnnotationCreate(BaseModel):
    label_id: int
    shape_type: ShapeType
    points: List[Any]
    frame: int = 0
    occluded: bool = False
    attributes: List[Any] = Field(default_factory=list)
    group_id: int = 0

    @field_validator("points")
    @classmethod
    def validate_points(cls, v, info):
        st = info.data.get("shape_type")
        if st is None:
            return v
        if len(v) < MIN_COORDS[st]:
            raise ValueError(
                f"{st.value} requires at least {MIN_COORDS[st]} coordinates, got {len(v)}"
            )
        if st == ShapeType.MASK:
            return v
        if len(v) % 2 != 0:
            raise ValueError("points must contain an even number of values (x,y pairs)")
        return v


class AnnotationUpdate(BaseModel):
    points: Optional[List[Any]] = None
    label_id: Optional[int] = None
    frame: Optional[int] = None
    occluded: Optional[bool] = None
    attributes: Optional[List[Any]] = None


class AnnotationResponse(BaseModel):
    id: int
    task_id: int
    image_id: Optional[int]
    frame: int
    label_id: int
    shape_type: ShapeType
    points: List[Any]
    occluded: bool
    source: str
    group_id: int
    updated_at: datetime

    class Config:
        from_attributes = True


class BulkAnnotationCreate(BaseModel):
    """For pasting multiple points (e.g. 68 face landmarks) in one request."""
    annotations: List[AnnotationCreate]


class CVATExportShape(BaseModel):
    type: str
    frame: int
    label_id: int
    group: int
    source: str
    attributes: List[Any]
    points: List[float]
    occluded: bool


class CVATAnnotationExport(BaseModel):
    version: int = 0
    tags: List[dict] = Field(default_factory=list)
    shapes: List[CVATExportShape] = Field(default_factory=list)
    tracks: List[dict] = Field(default_factory=list)


class BulkAnnotationPatch(BaseModel):
    """Apply the same patch to N annotations atomically.

    Used by: multi-select label reassignment, bulk occlude toggle,
    bulk frame shift, bulk delete, bulk attribute set.
    """
    ids: List[int] = Field(min_length=1, max_length=500)
    patch: AnnotationUpdate