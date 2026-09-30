import json
import os
from datetime import datetime, timezone

from app.services.exporters.base import Exporter, ExportContext, register


class COCOExporter(Exporter):
    name = "coco"
    supports_video = False

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
                continue

            pts = a["points"]
            st = a["shape_type"]

            if st == "rectangle":
                x1, y1, x2, y2 = pts
                x, y = min(x1, x2), min(y1, y2)
                w, h = abs(x2 - x1), abs(y2 - y1)
                ann_out.append({
                    "id": ann_id,
                    "image_id": a["image_id"],
                    "category_id": cat_id,
                    "iscrowd": 0,
                    "bbox": [x, y, w, h],
                    "area": w * h,
                    "segmentation": [[x, y, x + w, y, x + w, y + h, x, y + h]],
                })
                ann_id += 1

            elif st == "polygon":
                xs = pts[0::2]
                ys = pts[1::2]
                x, y = min(xs), min(ys)
                w, h = max(xs) - x, max(ys) - y
                ann_out.append({
                    "id": ann_id,
                    "image_id": a["image_id"],
                    "category_id": cat_id,
                    "iscrowd": 0,
                    "bbox": [x, y, w, h],
                    "area": w * h,
                    "segmentation": [pts],
                })
                ann_id += 1

            elif st == "polyline":
                xs = pts[0::2]
                ys = pts[1::2]
                x, y = min(xs), min(ys)
                w, h = (max(xs) - x) or 1, (max(ys) - y) or 1
                ann_out.append({
                    "id": ann_id,
                    "image_id": a["image_id"],
                    "category_id": cat_id,
                    "iscrowd": 0,
                    "bbox": [x, y, w, h],
                    "area": w * h,
                    "segmentation": [pts],
                })
                ann_id += 1

            elif st == "points":
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

            elif st == "mask":
                try:
                    rle = json.loads(pts[0])
                    ann_out.append({
                        "id": ann_id,
                        "image_id": a["image_id"],
                        "category_id": cat_id,
                        "iscrowd": 0,
                        "bbox": [0, 0, rle["size"][1], rle["size"][0]],
                        "area": sum(r for i, r in enumerate(rle["counts"]) if i % 2 == 1),
                        "segmentation": {"counts": rle["counts"], "size": rle["size"]},
                    })
                    ann_id += 1
                except Exception:
                    continue

        data = {
            "info": {
                "description": f"Annotra export — {ctx.task_name}",
                "version": "1.0",
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
