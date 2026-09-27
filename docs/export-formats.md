# Export Formats

## COCO JSON
- One file: `annotations.json`
- Rectangles → `bbox` + `segmentation` (4-point polygon)
- Polygons → `segmentation` (raw points)
- Polylines → `segmentation` (open, may fail in strict loaders)
- Points → 4x4 bounding boxes (workaround)

## YOLO
- `classes.txt` — one label per line
- `labels/<basename>.txt` — `<class> <cx> <cy> <w> <h>` normalized
- Polygons/polylines → axis-aligned bbox
- Points → skipped (not representable)

## Pascal VOC
- One XML per image in `annotations/`
- All shapes → axis-aligned bounding box
- `difficult=1` when occluded

## CVAT XML 1.1
- One file: `annotations.xml`
- Tracks preserved (`<track>` with keyframes)
- Full round-trip with CVAT itself
- Recommended when fidelity matters
