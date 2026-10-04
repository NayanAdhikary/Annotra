import os
import uuid
import shutil
from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.task import Task, Label
from app.models.ml_model import MLModel, InferenceJob
from app.schemas.ml import (
    MLModelResponse, InferenceRequest, InferenceJobResponse, LabelMappingSuggestion,
)
from app.services.audit import audit
from app.workers.inference_worker import run_inference_job

router = APIRouter()
import os
from app.config import settings

MODEL_ROOT = os.path.join(settings.DATA_DIR, "models")
os.makedirs(MODEL_ROOT, exist_ok=True)

ADMIN_ONLY = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER))


# ---------------- Model registry ----------------

@router.get("/admin/models", response_model=list[MLModelResponse])
async def list_models(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    rows = (await db.execute(
        select(MLModel).where(MLModel.is_active.is_(True))
        .order_by(MLModel.created_at.desc())
    )).scalars().all()
    return rows


@router.post("/admin/models/upload", response_model=MLModelResponse, status_code=201)
async def upload_model(
    name: str = Form(...),
    description: str = Form(""),
    version: str = Form("1.0"),
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    admin: User = ADMIN_ONLY,
):
    if not file.filename or not file.filename.lower().endswith(".pt"):
        raise HTTPException(422, "Only .pt (PyTorch) YOLO models are supported")

    model_dir = os.path.join(MODEL_ROOT, uuid.uuid4().hex)
    os.makedirs(model_dir, exist_ok=True)
    dest = os.path.join(model_dir, "model.pt")

    with open(dest, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)

    from app.services.inference import model_class_names, model_kind
    try:
        classes = model_class_names(dest)
        kind = model_kind(dest)
    except Exception as e:
        shutil.rmtree(model_dir, ignore_errors=True)
        raise HTTPException(422, f"Failed to load model: {e}")

    record = MLModel(
        name=name,
        version=version,
        kind=kind,
        file_path=dest,
        file_size=os.path.getsize(dest),
        class_names=classes,
        description=description or None,
        uploaded_by=admin.id,
    )
    db.add(record)
    await db.flush()

    await audit(db, user=admin, action="model.upload",
                resource_type="ml_model", resource_id=record.id,
                meta={"name": name, "kind": kind, "class_count": len(classes)},
                request=request)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/admin/models/{model_id}", status_code=204)
async def deactivate_model(
    model_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = ADMIN_ONLY,
):
    m = await db.get(MLModel, model_id)
    if m is None:
        raise HTTPException(404, "Model not found")
    m.is_active = False
    await audit(db, user=admin, action="model.deactivate",
                resource_type="ml_model", resource_id=model_id,
                request=request)
    await db.commit()


# ---------------- Mapping preview ----------------

@router.get("/tasks/{task_id}/models/{model_id}/mapping",
            response_model=LabelMappingSuggestion)
async def suggest_mapping(
    task_id: int,
    model_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    model = await db.get(MLModel, model_id)
    if model is None:
        raise HTTPException(404, "Model not found")

    labels = (await db.execute(
        select(Label).where(Label.task_id == task_id)
    )).scalars().all()

    by_name = {l.name.lower(): l.id for l in labels}
    suggested: dict[str, int] = {}
    unmatched: list[str] = []
    for cname in (model.class_names or []):
        lid = by_name.get(cname.lower())
        if lid is not None:
            suggested[cname] = lid
        else:
            unmatched.append(cname)

    return LabelMappingSuggestion(
        model_id=model_id,
        model_name=model.name,
        model_classes=model.class_names or [],
        suggested_mapping=suggested,
        unmatched_classes=unmatched,
    )


# ---------------- Inference jobs ----------------

@router.post("/tasks/{task_id}/predict",
             response_model=InferenceJobResponse, status_code=201)
async def start_inference(
    task_id: int,
    payload: InferenceRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    if task.task_type != "image":
        raise HTTPException(422, "Auto-annotation today only supports image tasks")

    model = await db.get(MLModel, payload.model_id)
    if model is None or not model.is_active:
        raise HTTPException(404, "Model not found or inactive")

    if not payload.label_mapping:
        raise HTTPException(422, "label_mapping is required")

    valid_ids = {
        l.id for l in (await db.execute(
            select(Label).where(Label.task_id == task_id)
        )).scalars()
    }
    for k, v in payload.label_mapping.items():
        if v not in valid_ids:
            raise HTTPException(422, f"Label id {v} not in this task")

    job = InferenceJob(
        task_id=task_id,
        model_id=payload.model_id,
        user_id=user.id,
        confidence=str(payload.confidence),
        label_mapping=payload.label_mapping,
        status="pending",
    )
    db.add(job)
    await db.flush()

    await audit(db, user=user, action="inference.start",
                resource_type="task", resource_id=task_id,
                meta={"model_id": payload.model_id, "job_id": job.id,
                      "confidence": payload.confidence},
                request=request)
    await db.commit()
    await db.refresh(job)

    run_inference_job.delay(job.id)
    return job


@router.get("/inference-jobs/{job_id}", response_model=InferenceJobResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = await db.get(InferenceJob, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/tasks/{task_id}/inference-jobs",
            response_model=list[InferenceJobResponse])
async def list_jobs(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(InferenceJob).where(InferenceJob.task_id == task_id)
        .order_by(InferenceJob.created_at.desc()).limit(20)
    )).scalars().all()
    return rows
