import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task import Task
from app.models.video import VideoAsset
from app.models.annotation import Annotation
from app.schemas.video import (
    VideoResponse, FrameListResponse, TrackCreate, KeyframePayload, TrackResponse,
)
from app.services.audit import audit
from app.workers.video_worker import extract_video_frames

router = APIRouter()

from app.config import settings

VIDEO_ROOT = os.path.join(settings.DATA_DIR, "videos")
FRAME_ROOT = os.path.join(settings.DATA_DIR, "frames")
ALLOWED_VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


@router.post("/tasks/{task_id}/videos/upload", response_model=VideoResponse)
async def upload_video(
    task_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    if task.task_type != "video":
        raise HTTPException(422, "This task is not a video task")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_VIDEO_EXT:
        raise HTTPException(422, f"Unsupported video format {ext}")

    task_dir = os.path.join(VIDEO_ROOT, str(task_id))
    os.makedirs(task_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(task_dir, safe_name)

    # Stream to disk — never load into memory
    with open(path, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)

    video = VideoAsset(
        task_id=task_id,
        filename=file.filename or safe_name,
        storage_path=path,
        frames_dir="",             # set after flush
        extraction_status="pending",
    )
    db.add(video)
    await db.flush()               # get the id

    video.frames_dir = os.path.join(FRAME_ROOT, str(video.id))
    os.makedirs(video.frames_dir, exist_ok=True)

    await audit(db, user=user, action="video.upload",
                resource_type="video", resource_id=video.id,
                meta={"filename": file.filename, "bytes": os.path.getsize(path)},
                request=request)
    await db.commit()
    await db.refresh(video)

    extract_video_frames.delay(video.id)
    return video


@router.get("/tasks/{task_id}/videos", response_model=list[VideoResponse])
async def list_videos(task_id: int, db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(VideoAsset).where(VideoAsset.task_id == task_id).order_by(VideoAsset.id)
    )).scalars().all()
    return rows


@router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video(video_id: int, db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_user)):
    v = await db.get(VideoAsset, video_id)
    if v is None:
        raise HTTPException(404, "Video not found")
    return v


@router.get("/videos/{video_id}/frames", response_model=FrameListResponse)
async def list_frames(video_id: int, db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    v = await db.get(VideoAsset, video_id)
    if v is None:
        raise HTTPException(404, "Video not found")
    if v.extraction_status != "done":
        raise HTTPException(409, f"Frames not ready (status: {v.extraction_status})")

    files = sorted(f for f in os.listdir(v.frames_dir) if f.endswith(".jpg"))
    return FrameListResponse(
        video_id=video_id,
        total_frames=len(files),
        width=v.width,
        height=v.height,
        frame_urls=[f"/static/frames/{video_id}/{f}" for f in files],
    )


# ---------------- Tracks ----------------

@router.post("/tasks/{task_id}/tracks", response_model=TrackResponse,
             status_code=201)
async def create_track(
    task_id: int,
    payload: TrackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")

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
        track_id=None,
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
        track_id=first.track_id, task_id=task_id,
        label_id=payload.label_id, shape_type=payload.shape_type,
        keyframes=[{
            "frame": payload.frame, "points": payload.points,
            "outside": payload.outside, "occluded": payload.occluded,
        }],
    )


@router.post("/tracks/{track_id}/keyframes", status_code=201)
async def add_keyframe(
    track_id: int,
    payload: KeyframePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    seed = (await db.execute(
        select(Annotation).where(Annotation.track_id == track_id).limit(1)
    )).scalar_one_or_none()
    if seed is None:
        raise HTTPException(404, "Track not found")

    existing = (await db.execute(
        select(Annotation).where(
            Annotation.track_id == track_id,
            Annotation.frame == payload.frame,
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
async def list_tracks(task_id: int, db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(Annotation)
        .where(Annotation.task_id == task_id, Annotation.track_id.is_not(None))
        .order_by(Annotation.track_id, Annotation.frame)
    )).scalars().all()

    grouped: dict[int, list[Annotation]] = {}
    for a in rows:
        grouped.setdefault(a.track_id, []).append(a)

    out = []
    for tid, anns in grouped.items():
        head = anns[0]
        out.append(TrackResponse(
            track_id=tid, task_id=task_id,
            label_id=head.label_id, shape_type=head.shape_type,
            keyframes=[{
                "frame": a.frame, "points": a.points,
                "outside": a.outside, "occluded": a.occluded,
            } for a in anns],
        ))
    return out


@router.delete("/tracks/{track_id}", status_code=204)
async def delete_track(track_id: int, request: Request,
                       db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    result = await db.execute(
        sql_delete(Annotation).where(Annotation.track_id == track_id)
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Track not found")
    await audit(db, user=user, action="track.delete",
                resource_type="track", resource_id=track_id, request=request)
    await db.commit()