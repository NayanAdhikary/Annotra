from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.routers import auth, projects, tasks, annotations, labels, images, admin, announcements, videos, exports, notifications

import time
from starlette.middleware.base import BaseHTTPMiddleware

_START_TIME = time.time()
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("/data/images", exist_ok=True)
os.makedirs("/data/videos", exist_ok=True)
os.makedirs("/data/frames", exist_ok=True)

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if 200 <= response.status_code < 300:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

app.mount("/static/images", CachedStaticFiles(directory="/data/images"), name="images")
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
@app.get("/health")
async def health():
    return {"status": "ok"}