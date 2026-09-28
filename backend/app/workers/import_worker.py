import json
import os
import shutil
import zipfile
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.workers import celery_app
from app.config import settings

UPLOAD_ROOT = "/data/imports"


@celery_app.task(bind=True, name="import.run", max_retries=0)
def run_import(self, job_id: int):
    from app.models.export_job import ImportJob
    from app.models.task import Task, Label, ImageAsset
    from app.models.annotation import Annotation
    from app.services.importers import (
        parse_coco, parse_yolo, parse_voc, parse_cvat, detect_format,
    )

    sync_dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_dsn)

    with Session(engine) as db:
        job = db.get(ImportJob, job_id)
        if job is None:
            return {"error": "not found"}

        job.status = "running"
        job.progress = "Extracting archive"
        db.commit()

        try:
            work = os.path.join(UPLOAD_ROOT, f"job-{job.id}")
            if os.path.exists(work):
                shutil.rmtree(work)
            os.makedirs(work)

            with zipfile.ZipFile(job.source_path) as zf:
                zf.extractall(work)

            job.progress = "Parsing"
            db.commit()

            fmt = job.format
            if fmt == "coco":
                ds = parse_coco(os.path.join(work, "annotations.json"))
            elif fmt == "yolo":
                ds = parse_yolo(
                    os.path.join(work, "images"),
                    os.path.join(work, "labels"),
                    os.path.join(work, "classes.txt"),
                )
            elif fmt == "voc":
                ds = parse_voc(os.path.join(work, "annotations"))
            elif fmt == "cvat":
                ds = parse_cvat(os.path.join(work, "annotations.xml"))
            else:
                raise ValueError(f"Unsupported import format: {fmt}")

            job.progress = f"Parsed {len(ds.annotations)} annotations"
            db.commit()

            # Resolve labels
            task_labels = {
                l.name.lower(): l.id
                for l in db.execute(
                    select(Label).where(Label.task_id == job.task_id)
                ).scalars()
            }
            mapping = json.loads(job.label_mapping or "{}")
            # mapping: {"external_name": task_label_id | null}

            # Create unknown labels if the caller asked us to (optional policy)
            # For now: skip unknown labels unless mapping specifies an id.

            # Map filenames to image assets
            image_by_name = {
                i.filename: i.id
                for i in db.execute(
                    select(ImageAsset).where(ImageAsset.task_id == job.task_id)
                ).scalars()
            }

            imported = 0
            skipped = 0
            unknown_labels: set[str] = set()

            for a in ds.annotations:
                task_label_id = mapping.get(a.external_label)
                if task_label_id is None:
                    # fallback: case-insensitive match on the label name
                    task_label_id = task_labels.get(a.external_label.lower())
                if task_label_id is None:
                    unknown_labels.add(a.external_label)
                    skipped += 1
                    continue

                image_id = image_by_name.get(a.filename)
                if image_id is None:
                    # Try by basename
                    for k, v in image_by_name.items():
                        if os.path.basename(k) == os.path.basename(a.filename):
                            image_id = v
                            break
                if image_id is None:
                    skipped += 1
                    continue

                db.add(Annotation(
                    task_id=job.task_id,
                    image_id=image_id,
                    label_id=task_label_id,
                    shape_type=a.shape_type,
                    points=a.points,
                    frame=a.frame,
                    occluded=a.occluded,
                    attributes=a.attributes or [],
                    source="auto" if job.as_preannotations else "manual",
                    review_status="pending" if job.as_preannotations else "pending",
                    is_keyframe=True,
                    created_by=job.user_id,
                ))
                imported += 1

            job.status = "done"
            job.progress = None
            job.stats = json.dumps({
                "imported": imported,
                "skipped": skipped,
                "unknown_labels": sorted(unknown_labels),
                "total": len(ds.annotations),
            })
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            shutil.rmtree(work, ignore_errors=True)
            return {"imported": imported, "skipped": skipped}

        except Exception as e:
            job.status = "failed"
            job.error = str(e)[:2000]
            db.commit()
            raise
