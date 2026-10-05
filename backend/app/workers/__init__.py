from app.config import settings
from app.core.logging import configure_logging

configure_logging()

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.RELEASE,
        traces_sample_rate=0.05,
        send_default_pii=False,
        integrations=[CeleryIntegration()],
    )

from celery import Celery

celery_app = Celery(
    "annotra",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    imports=[
        "app.workers.video_worker",
        "app.workers.export_worker",
        "app.workers.import_worker",
        "app.workers.cleanup_worker",
        "app.workers.inference_worker",
    ],
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_always_eager=True,
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

celery_app.conf.beat_schedule = {
    "cleanup-expired-exports": {
        "task": "cleanup.expired_exports",
        "schedule": 3600.0,
    },
}