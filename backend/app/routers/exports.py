import json
import os
import shutil
import uuid
import zipfile
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.task import Task, Label
from app.models.export_job import ExportJob, ImportJob
from app.schemas.export import (
    ExportRequest, ExportJobResponse, ImportRequest, ImportJobResponse,
    DetectImportRequest, DetectImportResponse,
)
from app.services.audit import audit
from app.services.importers import (
    parse_coco, parse_yolo, parse_voc, parse_cvat, detect_format,
)
from app.workers.export_worker import build_export
from app.workers.import_worker import run_import

router = APIRouter()
IMPORT_ROOT = "/data/imports"


async def _task_guard(db: AsyncSession, task_id: int, user: User) -> Task:
    t = await db.get(Task, task_id)
    if t is None:
        raise HTTPException(404, "Task not found")
    return t


# ---------------- Export ----------------

@router.post("/tasks/{task_id}/export",
             response_model=ExportJobResponse, status_code=201)
async def start_export(
    task_id: int, payload: ExportRequest, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _task_guard(db, task_id, user)

    from app.services.exporters import EXPORTERS
    if payload.format not in EXPORTERS:
        raise HTTPException(422, f"Unsupported format: {payload.format}")

    job = ExportJob(
        task_id=task_id, user_id=user.id,
        format=payload.format,
        include_images=payload.include_images,
        status="pending",
    )
    db.add(job)
    await db.flush()

    await audit(db, user=user, action="export.start",
                resource_type="task", resource_id=task_id,
                meta={"format": payload.format, "job_id": job.id},
                request=request)
    await db.commit()
    await db.refresh(job)

    build_export.delay(job.id)
    return ExportJobResponse.model_validate(job)


@router.get("/export-jobs/{job_id}", response_model=ExportJobResponse)
async def get_export_job(
    job_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = await db.get(ExportJob, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return ExportJobResponse.model_validate(job)


@router.get("/export-jobs/{job_id}/download")
async def download_export(
    job_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = await db.get(ExportJob, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(409, f"Job not ready (status: {job.status})")
    if not os.path.exists(job.file_path):
        raise HTTPException(410, "File has expired")

    fname = f"task-{job.task_id}-{job.format}.zip"
    return FileResponse(
        job.file_path,
        media_type="application/zip",
        filename=fname,
    )


@router.get("/tasks/{task_id}/export-jobs", response_model=list[ExportJobResponse])
async def list_export_jobs(
    task_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(ExportJob).where(ExportJob.task_id == task_id)
        .order_by(ExportJob.created_at.desc()).limit(50)
    )).scalars().all()
    return [ExportJobResponse.model_validate(r) for r in rows]


# ---------------- Import ----------------

@router.post("/tasks/{task_id}/import/detect",
             response_model=DetectImportResponse)
async def detect_import(
    task_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Upload an archive, extract to a temp dir, return detected format and
    external labels without importing anything. Used by the frontend to
    drive the label-mapping UI.
    """
    await _task_guard(db, task_id, user)

    tmp = os.path.join(IMPORT_ROOT, f"detect-{uuid.uuid4().hex}")
    os.makedirs(tmp, exist_ok=True)
    try:
        archive = os.path.join(tmp, "upload.zip")
        with open(archive, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

        with zipfile.ZipFile(archive) as zf:
            zf.extractall(tmp)

        fmt = detect_format(tmp)
        if fmt == "coco":
            ds = parse_coco(os.path.join(tmp, "annotations.json"))
        elif fmt == "yolo":
            ds = parse_yolo(
                os.path.join(tmp, "images"),
                os.path.join(tmp, "labels"),
                os.path.join(tmp, "classes.txt"),
            )
        elif fmt == "voc":
            ds = parse_voc(os.path.join(tmp, "annotations"))
        elif fmt == "cvat":
            ds = parse_cvat(os.path.join(tmp, "annotations.xml"))
        else:
            raise HTTPException(422, "Unsupported format")

        return DetectImportResponse(
            detected_format=fmt,
            external_labels=sorted(ds.external_labels),
            image_count=len(ds.image_files),
            annotation_count=len(ds.annotations),
        )
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@router.post("/tasks/{task_id}/import",
             response_model=ImportJobResponse, status_code=201)
async def start_import(
    task_id: int,
    format: str,
    label_mapping: str,        # JSON string
    as_preannotations: bool,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _task_guard(db, task_id, user)

    # Persist the uploaded archive
    job_dir = os.path.join(IMPORT_ROOT, uuid.uuid4().hex)
    os.makedirs(job_dir, exist_ok=True)
    archive = os.path.join(job_dir, "upload.zip")
    with open(archive, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)

    try:
        json.loads(label_mapping or "{}")
    except Exception:
        raise HTTPException(422, "label_mapping must be valid JSON")

    job = ImportJob(
        task_id=task_id, user_id=user.id,
        format=format, source_path=archive,
        label_mapping=label_mapping or "{}",
        as_preannotations=as_preannotations,
        status="pending",
    )
    db.add(job)
    await db.flush()

    await audit(db, user=user, action="import.start",
                resource_type="task", resource_id=task_id,
                meta={"format": format, "job_id": job.id,
                      "as_preannotations": as_preannotations},
                request=request)
    await db.commit()
    await db.refresh(job)

    run_import.delay(job.id)
    return ImportJobResponse.model_validate(job)


@router.get("/import-jobs/{job_id}", response_model=ImportJobResponse)
async def get_import_job(
    job_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = await db.get(ImportJob, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    resp = ImportJobResponse.model_validate(job)
    if job.stats:
        resp.stats = json.loads(job.stats)
    return resp
