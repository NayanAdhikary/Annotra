import subprocess
import os
from celery import Celery
from app.config import settings

celery_app = Celery("annotra", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

@celery_app.task
def extract_frames(video_path: str, output_dir: str, fps: int = 1):
    """Extract frames at given FPS using FFmpeg."""
    os.makedirs(output_dir, exist_ok=True)
    command = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"fps={fps}",
        "-q:v", "2",
        os.path.join(output_dir, "frame_%06d.jpg"),
    ]
    subprocess.run(command, check=True, capture_output=True)
    return {"output_dir": output_dir, "count": len(os.listdir(output_dir))}