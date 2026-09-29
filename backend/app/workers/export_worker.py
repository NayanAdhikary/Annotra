import json
import os
import shutil
import zipfile
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.workers import celery_app
from app.config import settings

EXPORT_ROOT = "/data/exports"


@celery_app.task(bind=True, name="export.build", max_retries=1)
def build_export(self, job_id: int):
    from app.models.export_job import ExportJob
    from app.models.task import Task, Label, ImageAsset
    from app.models.annotation import Annotation
    from app.models.video import VideoAsset
    from app.services.exporters import get_exporter, ExportContext

    sync_dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_dsn)

    with Session(engine) as db:
        job = db.get(ExportJob, job_id)
        if job is None:
            return {"error": "job not found"}

        job.status = "running"
        job.progress = "Loading task"
        db.commit()

        try:
            task = db.get(Task, job.task_id)
            labels = [
                {"id": l.id, "name": l.name, "color": l.color}
                for l in db.execute(select(Label).where(Label.task_id == job.task_id)).scalars()
            ]
            images = [
                {
                    "id": i.id, "filename": i.filename,
                    "width": i.width or 0, "height": i.height or 0,
                    "storage_path": i.storage_path, "frame": 0,
                }
                for i in db.execute(
                    select(ImageAsset).where(ImageAsset.task_id == job.task_id)
                ).scalars()
            ]

            # Video frames: if the task is a video task, export the frames as pseudo-images.
            if not images and task.task_type == "video":
                videos = db.execute(
                    select(VideoAsset).where(VideoAsset.task_id == job.task_id)
                ).scalars().all()
                for v in videos:
                    if v.extraction_status != "done":
                        continue
                    frame_files = sorted(
                        f for f in os.listdir(v.frames_dir) if f.endswith(".jpg")
                    )
                    for idx, fn in enumerate(frame_files):
                        images.append({
                            "id": v.id * 1_000_000 + idx,  # synthetic id
                            "filename": fn,
                            "width": v.width, "height": v.height,
                            "storage_path": os.path.join(v.frames_dir, fn),
                            "frame": idx,
                        })

            anns = []
            after_id = 0
            while True:
                batch = db.execute(
                    select(Annotation)
                    .where(Annotation.task_id == job.task_id, Annotation.id > after_id)
                    .order_by(Annotation.id)
                    .limit(5000)
                ).scalars().all()
                if not batch:
                    break
                for a in batch:
                    anns.append({
                        "id": a.id, "image_id": a.image_id, "frame": a.frame,
                        "label_id": a.label_id, "shape_type": a.shape_type,
                        "points": a.points, "occluded": a.occluded,
                        "attributes": a.attributes,
                        "track_id": a.track_id,
                        "is_keyframe": a.is_keyframe,
                        "outside": a.outside,
                        "source": a.source,
                    })
                after_id = batch[-1].id

            ctx = ExportContext(
                task_id=task.id, task_name=task.name,
                images=images, annotations=anns, labels=labels,
                include_images=job.include_images,
            )

            job.progress = "Writing annotation files"
            db.commit()

            # Build staging dir
            work_dir = os.path.join(EXPORT_ROOT, f"job-{job.id}")
            if os.path.exists(work_dir):
                shutil.rmtree(work_dir)
            os.makedirs(work_dir)

            exporter = get_exporter(job.format)
            exporter.write(work_dir, ctx)

            # Optionally copy images into the export
            if job.include_images:
                job.progress = "Copying images"
                db.commit()
                img_dir = os.path.join(work_dir, "images")
                os.makedirs(img_dir, exist_ok=True)
                for img in ctx.images:
                    if os.path.exists(img["storage_path"]):
                        shutil.copy2(img["storage_path"],
                                     os.path.join(img_dir, img["filename"]))

            # Zip it
            job.progress = "Packaging zip"
            db.commit()
            zip_path = os.path.join(EXPORT_ROOT, f"task-{task.id}-{job.format}-{job.id}.zip")
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for root_dir, _, files in os.walk(work_dir):
                    for f in files:
                        full = os.path.join(root_dir, f)
                        rel = os.path.relpath(full, work_dir)
                        zf.write(full, rel)

            shutil.rmtree(work_dir)

            job.file_path = zip_path
            job.file_size = os.path.getsize(zip_path)
            job.status = "done"
            job.progress = None
            job.completed_at = datetime.now(timezone.utc)
            job.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
            db.commit()

            return {"job_id": job_id, "size": job.file_size}

        except Exception as e:
            job.status = "failed"
            job.error = str(e)[:2000]
            db.commit()
            raise
