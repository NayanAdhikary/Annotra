import os
from app.services.exporters.base import Exporter, ExportContext, register


class YOLOExporter(Exporter):
    name = "yolo"
    supports_video = False

    def write(self, output_dir: str, ctx: ExportContext) -> None:
        labels_dir = os.path.join(output_dir, "labels")
        os.makedirs(labels_dir, exist_ok=True)

        label_index = {l["id"]: i for i, l in enumerate(ctx.labels)}

        with open(os.path.join(output_dir, "classes.txt"), "w") as f:
            for l in ctx.labels:
                f.write(f"{l['name']}\n")

        img_meta = {img["id"]: img for img in ctx.images}
        per_image: dict[int, list[str]] = {img["id"]: [] for img in ctx.images}

        for a in ctx.annotations:
            cls = label_index.get(a["label_id"])
            if cls is None or a["shape_type"] in ("points", "mask"):
                continue

            img = img_meta.get(a["image_id"])
            if img is None or not img["width"] or not img["height"]:
                continue

            pts = a["points"]
            xs = pts[0::2]
            ys = pts[1::2]
            x1, x2 = min(xs), max(xs)
            y1, y2 = min(ys), max(ys)

            w_img, h_img = img["width"], img["height"]
            cx = ((x1 + x2) / 2) / w_img
            cy = ((y1 + y2) / 2) / h_img
            w = (x2 - x1) / w_img
            h = (y2 - y1) / h_img

            per_image[a["image_id"]].append(
                f"{cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
            )

        for img in ctx.images:
            base = os.path.splitext(img["filename"])[0]
            with open(os.path.join(labels_dir, f"{base}.txt"), "w") as f:
                f.write("\n".join(per_image[img["id"]]))


register(YOLOExporter())