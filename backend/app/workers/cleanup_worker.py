import os
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.workers import celery_app
from app.config import settings


@celery_app.task(name="cleanup.expired_exports")
def cleanup_expired_exports():
    from app.models.export_job import ExportJob

    sync_dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_dsn)

    with Session(engine) as db:
        now = datetime.now(timezone.utc)
        expired = db.execute(
            select(ExportJob).where(
                ExportJob.status == "done",
                ExportJob.expires_at.is_not(None),
                ExportJob.expires_at < now,
            )
        ).scalars().all()

        removed = 0
        for job in expired:
            if job.file_path and os.path.exists(job.file_path):
                try:
                    os.remove(job.file_path)
                    removed += 1
                except OSError:
                    pass
        db.commit()
        return {"removed": removed}