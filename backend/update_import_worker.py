import os
import re

def update_import_worker():
    with open('app/workers/import_worker.py', 'r', encoding='utf-8') as f:
        content = f.read()

    search = '''            for a in ds.annotations:
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
                imported += 1'''

    replace = '''            pending_rows = []
            BATCH_SIZE = 1000

            for a in ds.annotations:
                task_label_id = mapping.get(a.external_label)
                if task_label_id is None:
                    task_label_id = task_labels.get(a.external_label.lower())
                if task_label_id is None:
                    unknown_labels.add(a.external_label)
                    skipped += 1
                    continue

                image_id = image_by_name.get(a.filename)
                if image_id is None:
                    for k, v in image_by_name.items():
                        if os.path.basename(k) == os.path.basename(a.filename):
                            image_id = v
                            break
                if image_id is None:
                    skipped += 1
                    continue

                pending_rows.append({
                    "task_id": job.task_id,
                    "image_id": image_id,
                    "label_id": task_label_id,
                    "shape_type": a.shape_type,
                    "points": a.points,
                    "frame": a.frame,
                    "occluded": a.occluded,
                    "attributes": a.attributes or [],
                    "source": "auto" if job.as_preannotations else "manual",
                    "review_status": "pending",
                    "is_keyframe": True,
                    "created_by": job.user_id,
                })
                
                if len(pending_rows) >= BATCH_SIZE:
                    db.bulk_insert_mappings(Annotation, pending_rows)
                    db.commit()
                    imported += len(pending_rows)
                    pending_rows = []
                    job.progress = f"Imported {imported}"
                    db.commit()

            if pending_rows:
                db.bulk_insert_mappings(Annotation, pending_rows)
                db.commit()
                imported += len(pending_rows)'''

    content = content.replace(search, replace)
    with open('app/workers/import_worker.py', 'w', encoding='utf-8') as f:
        f.write(content)

update_import_worker()
