import os
from xml.etree.ElementTree import Element, SubElement, ElementTree

from app.services.exporters.base import Exporter, ExportContext, register


class CVATExporter(Exporter):
    name = "cvat"
    supports_video = True

    def write(self, output_dir: str, ctx: ExportContext) -> None:
        root = Element("annotations")
        SubElement(root, "version").text = "1.1"

        meta = SubElement(root, "meta")
        task_el = SubElement(meta, "task")
        SubElement(task_el, "id").text = str(ctx.task_id)
        SubElement(task_el, "name").text = ctx.task_name
        SubElement(task_el, "size").text = str(len(ctx.images) or len(ctx.videos))

        labels_el = SubElement(task_el, "labels")
        for l in ctx.labels:
            lab = SubElement(labels_el, "label")
            SubElement(lab, "name").text = l["name"]
            SubElement(lab, "color").text = l["color"]

        labels_by_id = {l["id"]: l["name"] for l in ctx.labels}

        # Image-level shapes + track head representations
        image_els = {}
        for img in ctx.images:
            el = SubElement(root, "image", {
                "id": str(img["id"]),
                "name": img["filename"],
                "width": str(img["width"]),
                "height": str(img["height"]),
            })
            image_els[img["id"]] = el

        # Group annotations: tracks vs loose shapes
        tracks: dict[int, list[dict]] = {}
        loose: list[dict] = []
        for a in ctx.annotations:
            if a.get("track_id"):
                tracks.setdefault(a["track_id"], []).append(a)
            else:
                loose.append(a)

        # Emit <track> elements at top level (video objects)
        for tid, anns in tracks.items():
            head = anns[0]
            label_name = labels_by_id.get(head["label_id"], "")
            track_el = SubElement(root, "track", {
                "id": str(tid),
                "label": label_name,
                "source": head.get("source", "manual"),
            })
            for a in sorted(anns, key=lambda x: x["frame"]):
                attrs = {
                    "frame": str(a["frame"]),
                    "outside": "1" if a.get("outside") else "0",
                    "occluded": "1" if a.get("occluded") else "0",
                    "keyframe": "1" if a.get("is_keyframe", True) else "0",
                }
                self._emit_shape(track_el, a, attrs)

        # Emit loose shapes inside their <image>
        for a in loose:
            img_el = image_els.get(a["image_id"])
            if img_el is None:
                continue
            attrs = {
                "label": labels_by_id.get(a["label_id"], ""),
                "source": a.get("source", "manual"),
                "occluded": "1" if a.get("occluded") else "0",
            }
            self._emit_shape(img_el, a, attrs)

        ElementTree(root).write(
            os.path.join(output_dir, "annotations.xml"),
            encoding="utf-8", xml_declaration=True,
        )

    def _emit_shape(self, parent, a: dict, attrs: dict) -> None:
        st = a["shape_type"]
        pts = a["points"]
        if st == "rectangle":
            x1, y1, x2, y2 = pts
            SubElement(parent, "box", {
                **attrs,
                "xtl": f"{min(x1, x2):.2f}",
                "ytl": f"{min(y1, y2):.2f}",
                "xbr": f"{max(x1, x2):.2f}",
                "ybr": f"{max(y1, y2):.2f}",
            })
        elif st in ("polygon", "polyline"):
            pts_str = ";".join(
                f"{pts[i]:.2f},{pts[i+1]:.2f}" for i in range(0, len(pts), 2)
            )
            SubElement(parent, st, {**attrs, "points": pts_str})
        elif st == "points":
            pts_str = ";".join(
                f"{pts[i]:.2f},{pts[i+1]:.2f}" for i in range(0, len(pts), 2)
            )
            SubElement(parent, "points", {**attrs, "points": pts_str})
        # masks are not representable in CVAT XML 1.1 — skip silently


register(CVATExporter())