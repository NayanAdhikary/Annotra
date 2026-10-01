from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.routers import auth, projects, tasks, annotations, labels, images, admin, announcements, videos, exports, notifications, review, ml, image_status, submission

import time
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="Annotra API", version="0.1.0")

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
        return response

app.add_middleware(TimingMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

from app.config import settings

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.RELEASE,
        traces_sample_rate=0.05,
        profiles_sample_rate=0.05,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            CeleryIntegration(),
        ],
        send_default_pii=False,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import sys

# Use /data in production (Linux/Docker), fall back to ./data in dev (Windows)
DATA_DIR = os.environ.get("DATA_DIR", "/data" if sys.platform != "win32" else os.path.join(os.getcwd(), "data"))

os.makedirs(os.path.join(DATA_DIR, "images"), exist_ok=True)
os.makedirs("/data/videos", exist_ok=True)
os.makedirs("/data/frames", exist_ok=True)

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if 200 <= response.status_code < 300:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

app.mount("/static/images", CachedStaticFiles(directory=os.path.join(DATA_DIR, "images")), name="images")
app.mount("/static/videos", CachedStaticFiles(directory="/data/videos"), name="videos")
app.mount("/static/frames", CachedStaticFiles(directory="/data/frames"), name="frames")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api", tags=["projects"])
app.include_router(annotations.router, prefix="/api", tags=["annotations"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(labels.router, prefix="/api", tags=["labels"])
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(exports.router, prefix="/api", tags=["exports"])

os.makedirs("/data/exports", exist_ok=True)
os.makedirs("/data/imports", exist_ok=True)
app.include_router(announcements.router, prefix="/api", tags=["announcements"])
app.include_router(videos.router, prefix="/api", tags=["videos"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])
app.include_router(review.router, prefix="/api", tags=["review"])
app.include_router(ml.router, prefix="/api", tags=["ml"])
app.include_router(image_status.router, prefix="/api", tags=["image-status"])
app.include_router(submission.router, prefix="/api", tags=["submission"])
os.makedirs("/data/models", exist_ok=True)
@app.get("/health")
async def health():
    return {"status": "ok"}