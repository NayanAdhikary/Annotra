import os
import uuid
import shutil
from datetime import datetime, timezone
from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, File, Request,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.task import Task
from app.models.video import VideoAsset
from app.models.annotation import Annotation
from app.schemas.video import (
    VideoResponse, VideoFrameURLs, TrackCreate, KeyframeAdd, TrackResponse,
)
from app.services.audit import audit
from app.workers.video_worker import extract_video_frames

router = APIRouter()

VIDEO_ROOT = "/data/videos"
FRAME_ROOT = "/data/frames"

ALLOWED_EXT = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


async def _task_guard(db: AsyncSession, task_id: int, user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    return task


@router.post("/tasks/{task_id}/videos/upload", response_model=VideoResponse)
async def upload_video(
    task_id: int,
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _task_guard(db, task_id, user)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(422, f"Unsupported video format {ext}")

    task_dir = os.path.join(VIDEO_ROOT, str(task_id))
    os.makedirs(task_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(task_dir, safe_name)

    # Stream to disk — do NOT load into memory. A 2 GB video will kill a worker.
    with open(path, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)  # 1 MiB
            if not chunk:
                break
            out.write(chunk)

    video = VideoAsset(
        task_id=task_id,
        filename=file.filename or safe_name,
        storage_path=path,
        frames_dir="",  # set below
        extraction_status="pending",
    )
    db.add(video)
    await db.flush()

    video.frames_dir = os.path.join(FRAME_ROOT, str(video.id))
    os.makedirs(video.frames_dir, exist_ok=True)

    await audit(db, user=user, action="video.upload",
                resource_type="video", resource_id=video.id,
                meta={"filename": file.filename, "bytes": os.path.getsize(path)},
                request=request)
    await db.commit()
    await db.refresh(video)

    # Kick off extraction asynchronously
    extract_video_frames.delay(video.id)

    return VideoResponse.model_validate(video)


@router.get("/tasks/{task_id}/videos", response_model=list[VideoResponse])
async def list_videos(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _task_guard(db, task_id, user)
    rows = (await db.execute(
        select(VideoAsset).where(VideoAsset.task_id == task_id).order_by(VideoAsset.id)
    )).scalars().all()
    return [VideoResponse.model_validate(v) for v in rows]


@router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    v = await db.get(VideoAsset, video_id)
    if v is None:
        raise HTTPException(404, "Video not found")
    return VideoResponse.model_validate(v)


@router.get("/videos/{video_id}/frames", response_model=VideoFrameURLs)
async def list_frames(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    v = await db.get(VideoAsset, video_id)
    if v is None:
        raise HTTPException(404, "Video not found")
    if v.extraction_status != "done":
        raise HTTPException(409, f"Frames not ready (status: {v.extraction_status})")

    files = sorted(f for f in os.listdir(v.frames_dir) if f.endswith(".jpg"))
    # URL: /static/frames/{video_id}/{filename}
    return VideoFrameURLs(
        video_id=video_id,
        total_frames=len(files),
        width=v.width,
        height=v.height,
        frame_urls=[f"/static/frames/{video_id}/{f}" for f in files],
    )


@router.get("/videos/{video_id}/stream")
async def stream_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Serve the original video file. Range requests are handled by FileResponse
    when the client sends a Range header.
    """
    v = await db.get(VideoAsset, video_id)
    if v is None:
        raise HTTPException(404, "Video not found")
    return FileResponse(v.storage_path, media_type="video/mp4")


# ---------------- Tracks ----------------

@router.post("/tasks/{task_id}/tracks", response_model=TrackResponse)
async def create_track(
    task_id: int,
    payload: TrackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _task_guard(db, task_id, user)

    # Allocate a new track_id. We use the annotation id space so no separate
    # sequence is needed — the first keyframe's id becomes the track_id.
    first = Annotation(
        task_id=task_id,
        image_id=None,
        label_id=payload.label_id,
        shape_type=payload.shape_type,
        points=payload.points,
        frame=payload.frame,
        occluded=payload.occluded,
        attributes=[],
        source="manual",
        track_id=None,  # set below
        is_keyframe=True,
        outside=payload.outside,
        created_by=user.id,
    )
    db.add(first)
    await db.flush()
    first.track_id = first.id
    await db.flush()

    await audit(db, user=user, action="track.create",
                resource_type="track", resource_id=first.track_id,
                meta={"label_id": payload.label_id, "frame": payload.frame},
                request=request)
    await db.commit()

    return TrackResponse(
        track_id=first.track_id, task_id=task_id, video_id=0,
        label_id=payload.label_id, shape_type=payload.shape_type,
        keyframes=[{
            "frame": payload.frame, "points": payload.points,
            "outside": payload.outside, "occluded": payload.occluded,
        }],
    )


@router.post("/tracks/{track_id}/keyframes", status_code=201)
async def add_keyframe(
    track_id: int,
    payload: KeyframeAdd,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Load the track's first annotation to inherit task_id, label_id, shape_type
    seed = (await db.execute(
        select(Annotation).where(Annotation.track_id == track_id).limit(1)
    )).scalar_one_or_none()
    if seed is None:
        raise HTTPException(404, "Track not found")

    # Replace if a keyframe already exists on this frame
    existing = (await db.execute(
        select(Annotation).where(
            Annotation.track_id == track_id, Annotation.frame == payload.frame,
        )
    )).scalar_one_or_none()

    if existing:
        existing.points = payload.points
        existing.outside = payload.outside
        existing.occluded = payload.occluded
        existing.is_keyframe = True
    else:
        db.add(Annotation(
            task_id=seed.task_id,
            image_id=None,
            label_id=seed.label_id,
            shape_type=seed.shape_type,
            points=payload.points,
            frame=payload.frame,
            occluded=payload.occluded,
            attributes=[],
            source="manual",
            track_id=track_id,
            is_keyframe=True,
            outside=payload.outside,
            created_by=user.id,
        ))

    await audit(db, user=user, action="track.keyframe_add",
                resource_type="track", resource_id=track_id,
                meta={"frame": payload.frame}, request=request)
    await db.commit()
    return {"ok": True}


@router.get("/tasks/{task_id}/tracks", response_model=list[TrackResponse])
async def list_tracks(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _task_guard(db, task_id, user)
    rows = (await db.execute(
        select(Annotation)
        .where(Annotation.task_id == task_id, Annotation.track_id.is_not(None))
        .order_by(Annotation.track_id, Annotation.frame)
    )).scalars().all()

    by_track: dict[int, list[Annotation]] = {}
    for a in rows:
        by_track.setdefault(a.track_id, []).append(a)

    out = []
    for tid, anns in by_track.items():
        head = anns[0]
        out.append(TrackResponse(
            track_id=tid, task_id=task_id, video_id=0,
            label_id=head.label_id, shape_type=head.shape_type,
            keyframes=[{
                "frame": a.frame, "points": a.points,
                "outside": a.outside, "occluded": a.occluded,
            } for a in anns],
        ))
    return out


@router.delete("/tracks/{track_id}", status_code=204)
async def delete_track(
    track_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import delete as sql_delete
    result = await db.execute(
        sql_delete(Annotation).where(Annotation.track_id == track_id)
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Track not found")
    await audit(db, user=user, action="track.delete",
                resource_type="track", resource_id=track_id,
                request=request)
    await db.commit()