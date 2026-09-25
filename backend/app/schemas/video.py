from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class VideoResponse(BaseModel):
    id: int
    task_id: int
    filename: str
    duration_sec: float
    fps: float
    total_frames: int
    width: int
    height: int
    extraction_status: str
    extraction_error: Optional[str]

    class Config:
        from_attributes = True


class VideoFrameURLs(BaseModel):
    video_id: int
    total_frames: int
    width: int
    height: int
    frame_urls: List[str]


class TrackCreate(BaseModel):
    label_id: int
    shape_type: str
    points: List[float]
    frame: int = 0
    outside: bool = False
    occluded: bool = False


class KeyframeAdd(BaseModel):
    frame: int
    points: List[float]
    outside: bool = False
    occluded: bool = False


class TrackResponse(BaseModel):
    track_id: int
    task_id: int
    video_id: int
    label_id: int
    shape_type: str
    keyframes: List[dict]  # [{frame, points, outside, occluded}]
