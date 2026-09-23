from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.workers.frame_extractor import extract_frames
import shutil, os

router = APIRouter()

@router.post("/videos/upload")
async def upload_video(task_id: int, file: UploadFile = File(...)):
    upload_dir = f"/data/videos/{task_id}"
    os.makedirs(upload_dir, exist_ok=True)
    video_path = os.path.join(upload_dir, file.filename)

    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Trigger async frame extraction
    output_dir = f"/data/frames/{task_id}"
    task = extract_frames.delay(video_path, output_dir, fps=1)
    return {"video_path": video_path, "frame_task_id": task.id, "output_dir": output_dir}