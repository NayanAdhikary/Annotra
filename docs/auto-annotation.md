# Auto-Annotation

## Supported models
- YOLOv8 detection (`.pt`)
- YOLOv8 segmentation (`.pt` — polygons extracted)

## Workflow
1. Admin uploads a model at `/admin/models`
2. Manager opens a task → **🧠 Predict**
3. Pick model, tune confidence, confirm the label mapping
4. Inference runs in a Celery worker
5. Detections land as `source=auto`, `review_status=pending`

## Attributes
Every prediction carries:
- `confidence` — float
- `predicted_class` — original model class name

## Reviewing predictions
- **Shift+A** on the workspace accepts every ML prediction on the frame
- Review tab has a "Only ML predictions" filter
- Sidebar shows a purple **ML** badge

## Constraints today
- Image tasks only
- One model per job
- CPU inference: ~200ms per image, so a 1000-image task takes ~3-4 minutes
