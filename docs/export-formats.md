# Export Formats

## Choosing a format

| Format | Image | Video | Preserves |
|---|---|---|---|
| COCO JSON | ✅ | ❌ | Rectangles, polygons, RLE masks |
| YOLO txt | ✅ | ❌ | Rectangles only |
| Pascal VOC | ✅ | ❌ | Rectangles (converted from polygons) |
| CVAT XML 1.1 | ✅ | ✅ | Everything, including video tracks and keyframes |

**Use CVAT XML when fidelity matters or when you're working with video.**

## COCO JSON
- Single file: `annotations.json`
- Rectangles → `bbox` + 4-point `segmentation`
- Polygons → raw `segmentation` array
- Masks → RLE `{counts, size}`
- Points → 4×4 bounding boxes (COCO limitation)

## YOLO
- `classes.txt` — one label per line
- `labels/<basename>.txt` — `<class> <cx> <cy> <w> <h>` normalized
- Polygons and polylines collapse to their bounding box
- Points and masks are skipped

## Pascal VOC
- One XML per image in `annotations/`
- All shapes → axis-aligned bounding box
- `difficult=1` when occluded

## CVAT XML 1.1
- One file: `annotations.xml`
- Full track support with keyframes
- Round-trips with CVAT itself
- Recommended for video and for round-tripping with other CVAT users
