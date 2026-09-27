import os
from xml.etree.ElementTree import Element, SubElement, ElementTree

from app.services.exporters.base import Exporter, ExportContext, register


class CVATExporter(Exporter):
    """
    CVAT XML 1.1. This is the format that makes Annotra round-trip compatible
    with CVAT itself. Uses <track> for objects with track_id, <box>/<polygon>/
    <polyline>/<points> for individual shapes.
    """
    name = "cvat"
    file_extension = ".xml"

    def write(self, output_dir: str, ctx: ExportContext) -> None:
        root = Element("annotations")
        version = SubElement(root, "version")
        version.text = "1.1"

        meta = SubElement(root, "meta")
        task_el = SubElement(meta, "task")
        SubElement(task_el, "id").text = str(ctx.task_id)
        SubElement(task_el, "name").text = ctx.task_name
        SubElement(task_el, "size").text = str(len(ctx.images))

        labels_el = SubElement(task_el, "labels")
        for l in ctx.labels:
            lab = SubElement(labels_el, "label")
            SubElement(lab, "name").text = l["name"]
            SubElement(lab, "color").text = l["color"]

        # Image list
        for img in ctx.images:
            img_el = SubElement(root, "image", {
                "id": str(img["id"]),
                "name": img["filename"],
                "width": str(img["width"]),
                "height": str(img["height"]),
            })

        # Group annotations by track_id
        tracks: dict[int, list[dict]] = {}
        loose: list[dict] = []
        for a in ctx.annotations:
            if a.get("track_id"):
                tracks.setdefault(a["track_id"], []).append(a)
            else:
                loose.append(a)

        labels_by_id = {l["id"]: l["name"] for l in ctx.labels}

        # Emit <track> elements
        for track_id, anns in tracks.items():
            head = anns[0]
            label_name = labels_by_id.get(head["label_id"], "")
            track_el = SubElement(root, "track", {
                "id": str(track_id),
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
                if a["shape_type"] == "rectangle":
                    x1, y1, x2, y2 = a["points"]
                    SubElement(track_el, "box", {
                        **attrs,
                        "xtl": f"{min(x1, x2):.2f}",
                        "ytl": f"{min(y1, y2):.2f}",
                        "xbr": f"{max(x1, x2):.2f}",
                        "ybr": f"{max(y1, y2):.2f}",
                    })
                elif a["shape_type"] in ("polygon", "polyline"):
                    pts_str = ";".join(
                        f"{a['points'][i]:.2f},{a['points'][i+1]:.2f}"
                        for i in range(0, len(a["points"]), 2)
                    )
                    tag = "polygon" if a["shape_type"] == "polygon" else "polyline"
                    SubElement(track_el, tag, {**attrs, "points": pts_str})
                elif a["shape_type"] == "points":
                    pts_str = ";".join(
                        f"{a['points'][i]:.2f},{a['points'][i+1]:.2f}"
                        for i in range(0, len(a["points"]), 2)
                    )
                    SubElement(track_el, "points", {**attrs, "points": pts_str})

        # Emit loose shapes as <image>-scoped elements inside their <image>
        image_els = {int(el.get("id")): el for el in root.findall("image")}
        for a in loose:
            img_el = image_els.get(a["image_id"])
            if img_el is None:
                continue
            label_name = labels_by_id.get(a["label_id"], "")
            attrs = {
                "label": label_name,
                "source": a.get("source", "manual"),
                "occluded": "1" if a.get("occluded") else "0",
            }
            if a["shape_type"] == "rectangle":
                x1, y1, x2, y2 = a["points"]
                SubElement(img_el, "box", {
                    **attrs,
                    "xtl": f"{min(x1, x2):.2f}",
                    "ytl": f"{min(y1, y2):.2f}",
                    "xbr": f"{max(x1, x2):.2f}",
                    "ybr": f"{max(y1, y2):.2f}",
                })
            elif a["shape_type"] in ("polygon", "polyline"):
                pts_str = ";".join(
                    f"{a['points'][i]:.2f},{a['points'][i+1]:.2f}"
                    for i in range(0, len(a["points"]), 2)
                )
                tag = "polygon" if a["shape_type"] == "polygon" else "polyline"
                SubElement(img_el, tag, {**attrs, "points": pts_str})
            elif a["shape_type"] == "points":
                pts_str = ";".join(
                    f"{a['points'][i]:.2f},{a['points'][i+1]:.2f}"
                    for i in range(0, len(a["points"]), 2)
                )
                SubElement(img_el, "points", {**attrs, "points": pts_str})

        ElementTree(root).write(
            os.path.join(output_dir, "annotations.xml"),
            encoding="utf-8", xml_declaration=True,
        )


register(CVATExporter())
