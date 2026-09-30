import traceback
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.workers import celery_app
from app.config import settings


@celery_app.task(bind=True, name="inference.run", max_retries=0)
def run_inference_job(self, job_id: int):
    from app.models.ml_model import MLModel, InferenceJob
    from app.models.task import Task, Label, ImageAsset
    from app.models.annotation import Annotation
    from app.services.inference import run_inference

    sync_dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_dsn)

    with Session(engine) as db:
        job = db.get(InferenceJob, job_id)
        if job is None:
            return {"error": "job not found"}

        job.status = "running"
        job.progress = "Loading model"
        db.commit()

        try:
            model = db.get(MLModel, job.model_id)
            task = db.get(Task, job.task_id)
            if model is None or task is None:
                raise ValueError("Model or task missing")

            labels = db.execute(
                select(Label).where(Label.task_id == job.task_id)
            ).scalars().all()
            label_by_id = {l.id: l for l in labels}

            mapping = job.label_mapping or {}
            if not mapping:
                by_name = {l.name.lower(): l.id for l in labels}
                mapping = {c: by_name.get(c.lower()) for c in (model.class_names or [])}
                mapping = {k: v for k, v in mapping.items() if v is not None}
                job.label_mapping = mapping
                db.commit()

            if not mapping:
                raise ValueError(
                    "No classes could be mapped. Provide label_mapping "
                    "or rename task labels to match model classes."
                )

            images = db.execute(
                select(ImageAsset).where(ImageAsset.task_id == job.task_id)
                .order_by(ImageAsset.id)
            ).scalars().all()

            total = len(images)
            confidence = float(job.confidence or "0.25")

            created = 0
            detections_total = 0
            skipped = 0
            class_counts: dict[str, int] = {}

            for idx, img in enumerate(images):
                job.progress = f"Processing {idx + 1}/{total}"
                if idx % 5 == 0:
                    db.commit()

                dets = run_inference(
                    model_path=model.file_path,
                    image_path=img.storage_path,
                    confidence=confidence,
                )
                detections_total += len(dets)

                for d in dets:
                    label_id = mapping.get(d.class_name)
                    if label_id is None or label_id not in label_by_id:
                        skipped += 1
                        continue

                    if len(d.points) < 4:
                        skipped += 1
                        continue
                    if d.shape_type == "rectangle" and len(d.points) != 4:
                        skipped += 1
                        continue
                    if d.shape_type == "polygon" and len(d.points) < 6:
                        skipped += 1
                        continue

                    db.add(Annotation(
                        task_id=job.task_id,
                        image_id=img.id,
                        label_id=label_id,
                        shape_type=d.shape_type,
                        points=d.points,
                        frame=0,
                        occluded=False,
                        attributes=[
                            {"name": "confidence", "value": round(d.confidence, 4)},
                            {"name": "predicted_class", "value": d.class_name},
                        ],
                        source="auto",
                        review_status="pending",
                        is_keyframe=True,
                        created_by=job.user_id,
                    ))
                    created += 1
                    class_counts[d.class_name] = class_counts.get(d.class_name, 0) + 1

            job.status = "done"
            job.progress = None
            job.completed_at = datetime.now(timezone.utc)
            job.stats = {
                "images_processed": total,
                "detections": detections_total,
                "annotations_created": created,
                "skipped": skipped,
                "class_counts": class_counts,
            }
            db.commit()
            return {"job_id": job_id, "created": created}

        except Exception as e:
            job.status = "failed"
            job.error = f"{e}\n{traceback.format_exc()[-1500:]}"
            db.commit()
            raise
