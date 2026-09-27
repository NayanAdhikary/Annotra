from celery import Celery
from app.config import settings


celery_app = Celery(
    "annotra",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_max_tasks_per_child=50,  # guards against ffmpeg leaks
    task_always_eager=True,
    task_eager_propagates=True,
)

celery_app.conf.beat_schedule = {
    "cleanup-expired-exports": {
        "task": "cleanup.expired_exports",
        "schedule": 3600.0,  # hourly
    },
}