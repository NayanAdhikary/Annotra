from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os, sys, time
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

# ---------------------------------------------------------------------------
# Data directories (cross-platform: ./data on Windows, /data in production)
# ---------------------------------------------------------------------------
DATA_DIR = os.environ.get(
    "DATA_DIR",
    "/data" if sys.platform != "win32" else os.path.join(os.getcwd(), "data"),
)
for sub in ("images", "videos", "frames", "exports", "imports", "models"):
    os.makedirs(os.path.join(DATA_DIR, sub), exist_ok=True)

# ---------------------------------------------------------------------------
# Sentry (no-op when SENTRY_DSN is empty)
# ---------------------------------------------------------------------------
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
        integrations=[FastApiIntegration(), SqlalchemyIntegration(), CeleryIntegration()],
        send_default_pii=False,
    )

# ---------------------------------------------------------------------------
# Lifespan: enable SQLite performance PRAGMAs on startup
# ---------------------------------------------------------------------------
from app.core.database import engine

@asynccontextmanager
async def lifespan(application: FastAPI):
    if settings.DATABASE_URL.startswith("sqlite"):
        async with engine.begin() as conn:
            await conn.exec_driver_sql("PRAGMA journal_mode=WAL")      # concurrent readers
            await conn.exec_driver_sql("PRAGMA synchronous=NORMAL")    # safe & fast
            await conn.exec_driver_sql("PRAGMA cache_size=-32000")     # 32 MB page cache
            await conn.exec_driver_sql("PRAGMA temp_store=MEMORY")     # temp tables in RAM
            await conn.exec_driver_sql("PRAGMA mmap_size=268435456")   # 256 MB memory-map
    yield

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Annotra API", version="0.1.0", lifespan=lifespan)

from fastapi.responses import JSONResponse
import traceback
@app.exception_handler(Exception)
async def debug_exception_handler(request, exc):
    return JSONResponse(status_code=500, content={"detail": str(exc), "traceback": traceback.format_exc()})

# Timing header (visible in browser DevTools Network tab)
class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
        return response

app.add_middleware(TimingMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static files with aggressive browser caching (images never change in place)
# ---------------------------------------------------------------------------
class CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if 200 <= response.status_code < 300:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

app.mount("/static/images", CachedStaticFiles(directory=os.path.join(DATA_DIR, "images")), name="images")
app.mount("/static/videos", CachedStaticFiles(directory=os.path.join(DATA_DIR, "videos")), name="videos")
app.mount("/static/frames", CachedStaticFiles(directory=os.path.join(DATA_DIR, "frames")), name="frames")

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.routers import (
    auth, projects, tasks, annotations, labels, images, admin,
    announcements, videos, exports, notifications, review,
    ml, image_status, submission, tool_config,
)

app.include_router(auth.router,          prefix="/api/auth",  tags=["auth"])
app.include_router(projects.router,      prefix="/api",       tags=["projects"])
app.include_router(annotations.router,   prefix="/api",       tags=["annotations"])
app.include_router(tasks.router,         prefix="/api",       tags=["tasks"])
app.include_router(labels.router,        prefix="/api",       tags=["labels"])
app.include_router(images.router,        prefix="/api",       tags=["images"])
app.include_router(admin.router,         prefix="/api/admin", tags=["admin"])
app.include_router(exports.router,       prefix="/api",       tags=["exports"])
app.include_router(announcements.router, prefix="/api",       tags=["announcements"])
app.include_router(videos.router,        prefix="/api",       tags=["videos"])
app.include_router(notifications.router, prefix="/api",       tags=["notifications"])
app.include_router(review.router,        prefix="/api",       tags=["review"])
app.include_router(ml.router,            prefix="/api",       tags=["ml"])
app.include_router(image_status.router,  prefix="/api",       tags=["image-status"])
app.include_router(submission.router,    prefix="/api",       tags=["submission"])
app.include_router(tool_config.router,   prefix="/api",       tags=["tool-config"])

@app.get("/health")
async def health():
    return {"status": "ok"}