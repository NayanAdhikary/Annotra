from celery import Celery
from app.config import settings

celery_app = Celery("annotra", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_max_tasks_per_child=50,
    task_routes={
        "video.extract_frames": {"queue": "heavy"},
        "inference.run": {"queue": "heavy"},
        "export.build": {"queue": "medium"},
        "import.run": {"queue": "medium"},
        "cleanup.expired_exports": {"queue": "light"},
    },
    task_default_queue="medium",
)