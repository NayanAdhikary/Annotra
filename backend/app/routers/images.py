from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from PIL import Image as PILImage
import os, uuid, io

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.task import Task, ImageAsset, Project
from app.models.user import User, UserRole

router = APIRouter()

async def _assert_can_edit_task(db: AsyncSession, task_id: int, user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    project = await db.get(Project, task.project_id)
    if project.owner_id != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your project")
    return task

import sys

_DATA_DIR = os.environ.get("DATA_DIR", "/data" if sys.platform != "win32" else os.path.join(os.getcwd(), "data"))
UPLOAD_ROOT = os.path.join(_DATA_DIR, "images")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _validate_image(raw: bytes) -> tuple[int, int]:
    try:
        img = PILImage.open(io.BytesIO(raw))
        img.verify()
        img = PILImage.open(io.BytesIO(raw))  # re-open after verify
        return img.width, img.height
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a valid image")


@router.post("/tasks/{task_id}/images/upload")
async def upload_image(
    task_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = await _assert_can_edit_task(db, task_id, user)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported extension {ext}")

    raw = await file.read()
    width, height = _validate_image(raw)

    task_dir = os.path.join(UPLOAD_ROOT, str(task_id))
    os.makedirs(task_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(task_dir, safe_name)
    with open(abs_path, "wb") as f:
        f.write(raw)

    asset = ImageAsset(
        task_id=task_id,
        filename=file.filename,
        width=width,
        height=height,
        storage_path=abs_path,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return {
        "id": asset.id,
        "filename": asset.filename,
        "width": asset.width,
        "height": asset.height,
        "url": f"/static/images/{task_id}/{safe_name}",
    }


@router.get("/tasks/{task_id}/images")
async def list_images(task_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(ImageAsset).where(ImageAsset.task_id == task_id).order_by(ImageAsset.id)
    )
    assets = res.scalars().all()
    return [
        {
            "id": a.id,
            "filename": a.filename,
            "width": a.width,
            "height": a.height,
            "url": f"/static/images/{task_id}/{os.path.basename(a.storage_path)}",
        }
        for a in assets
    ]
