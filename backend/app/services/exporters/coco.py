import json
import os
from datetime import datetime, timezone

from app.services.exporters.base import Exporter, ExportContext, register


class COCOExporter(Exporter):
    """
    COCO 1.0 detection format.

    {
      "info": {...},
      "licenses": [],
      "images": [{"id", "file_name", "width", "height"}],
      "annotations": [
        {
          "id", "image_id", "category_id",
          "bbox": [x, y, w, h], "area", "iscrowd": 0,
          "segmentation": [[x1,y1, x2,y2, ...]]  # for polygons
        }
      ],
      "categories": [{"id", "name", "supercategory": ""}]
    }

    Note: COCO only supports rectangle and polygon. Polylines are stored as
    multi-segment `segmentation` arrays; points are stored as `keypoints`
    only in the person layout, so we store them as tiny rectangles of 1px.
    """
    name = "coco"
    file_extension = ".json"

    def write(self, output_dir: str, ctx: ExportContext) -> None:
        label_index = {l["id"]: i + 1 for i, l in enumerate(ctx.labels)}

        images_out = []
        for img in ctx.images:
            images_out.append({
                "id": img["id"],
                "file_name": img["filename"],
                "width": img["width"],
                "height": img["height"],
            })

        ann_out = []
        ann_id = 1
        for a in ctx.annotations:
            cat_id = label_index.get(a["label_id"])
            if cat_id is None:
                continue  # skip annotations whose label was deleted

            pts = a["points"]
            entry = {
                "id": ann_id,
                "image_id": a["image_id"],
                "category_id": cat_id,
                "iscrowd": 0,
                "attributes": {**{f"attr_{i}": v for i, v in enumerate(a.get("attributes") or [])}},
            }

            if a["shape_type"] == "rectangle":
                x1, y1, x2, y2 = pts
                x = min(x1, x2); y = min(y1, y2)
                w = abs(x2 - x1); h = abs(y2 - y1)
                entry["bbox"] = [x, y, w, h]
                entry["area"] = w * h
                entry["segmentation"] = [[x, y, x + w, y, x + w, y + h, x, y + h]]

            elif a["shape_type"] == "polygon":
                xs = pts[0::2]; ys = pts[1::2]
                x = min(xs); y = min(ys)
                w = max(xs) - x; h = max(ys) - y
                entry["bbox"] = [x, y, w, h]
                entry["area"] = w * h
                entry["segmentation"] = [pts]

            elif a["shape_type"] == "polyline":
                xs = pts[0::2]; ys = pts[1::2]
                x = min(xs); y = min(ys)
                w = max(xs) - x or 1; h = max(ys) - y or 1
                entry["bbox"] = [x, y, w, h]
                entry["area"] = w * h
                entry["segmentation"] = [pts]   # open polyline; some loaders accept this

            elif a["shape_type"] == "points":
                # Each point becomes a 4x4 box
                for i in range(0, len(pts), 2):
                    px, py = pts[i], pts[i + 1]
                    ann_out.append({
                        "id": ann_id,
                        "image_id": a["image_id"],
                        "category_id": cat_id,
                        "iscrowd": 0,
                        "bbox": [px - 2, py - 2, 4, 4],
                        "area": 16,
                        "segmentation": [],
                    })
                    ann_id += 1
                continue

            ann_out.append(entry)
            ann_id += 1

        data = {
            "info": {
                "description": f"Annotra export — {ctx.task_name}",
                "version": "1.0",
                "year": datetime.now(timezone.utc).year,
                "date_created": datetime.now(timezone.utc).isoformat(),
            },
            "licenses": [],
            "images": images_out,
            "annotations": ann_out,
            "categories": [
                {"id": label_index[l["id"]], "name": l["name"], "supercategory": ""}
                for l in ctx.labels
            ],
        }

        with open(os.path.join(output_dir, "annotations.json"), "w") as f:
            json.dump(data, f, indent=2)


register(COCOExporter())
