from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.workers import celery_app
from app.config import settings
from app.services.video import probe_video, extract_frames


@celery_app.task(bind=True, max_retries=1, name="video.extract_frames")
def extract_video_frames(self, video_id: int):
    from app.models.video import VideoAsset

    sync_dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_dsn)

    with Session(engine) as db:
        video = db.get(VideoAsset, video_id)
        if video is None:
            return {"error": "not found"}

        video.extraction_status = "running"
        video.extraction_job_id = self.request.id
        db.commit()

        try:
            meta = probe_video(video.storage_path)
            video.duration_sec = meta.duration_sec
            video.fps = meta.fps
            video.total_frames = meta.total_frames
            video.width = meta.width
            video.height = meta.height
            db.commit()

            count = extract_frames(
                video_path=video.storage_path,
                output_dir=video.frames_dir,
                fps=meta.fps if meta.fps > 0 else None,
            )

            video.total_frames = count
            video.extraction_status = "done"
            video.extraction_error = None
            db.commit()
            return {"video_id": video_id, "frames": count}

        except Exception as e:
            video.extraction_status = "failed"
            video.extraction_error = str(e)[:1000]
            db.commit()
            raise self.retry(exc=e, countdown=10)