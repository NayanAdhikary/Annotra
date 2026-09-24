from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, projects, tasks, annotations, labels, images, admin

app = FastAPI(title="Annotra API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("/data/images", exist_ok=True)
app.mount("/static/images", StaticFiles(directory="/data/images"), name="images")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api", tags=["projects"])
app.include_router(annotations.router, prefix="/api", tags=["annotations"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(labels.router, prefix="/api", tags=["labels"])
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
@app.get("/health")
async def health():
    return {"status": "ok"}