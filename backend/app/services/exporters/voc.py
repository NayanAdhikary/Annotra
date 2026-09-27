import os
from xml.etree.ElementTree import Element, SubElement, ElementTree

from app.services.exporters.base import Exporter, ExportContext, register


class VOCExporter(Exporter):
    """
    Pascal VOC 2007. One XML per image:

    <annotation>
      <folder>images</folder>
      <filename>foo.jpg</filename>
      <size><width>1920</width><height>1080</height><depth>3</depth></size>
      <object>
        <name>car</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
          <xmin>..</xmin><ymin>..</ymin><xmax>..</xmax><ymax>..</ymax>
        </bndbox>
      </object>
    </annotation>

    Polygons/polylines are stored as their bounding box. Points are skipped.
    """
    name = "voc"
    file_extension = ".xml"

    def write(self, output_dir: str, ctx: ExportContext) -> None:
        ann_dir = os.path.join(output_dir, "annotations")
        os.makedirs(ann_dir, exist_ok=True)

        labels = {l["id"]: l["name"] for l in ctx.labels}
        by_image: dict[int, list[dict]] = {}
        for a in ctx.annotations:
            if a["shape_type"] == "points":
                continue
            by_image.setdefault(a["image_id"], []).append(a)

        for img in ctx.images:
            root = Element("annotation")
            SubElement(root, "folder").text = "images"
            SubElement(root, "filename").text = img["filename"]

            size = SubElement(root, "size")
            SubElement(size, "width").text = str(img["width"])
            SubElement(size, "height").text = str(img["height"])
            SubElement(size, "depth").text = "3"

            for a in by_image.get(img["id"], []):
                name = labels.get(a["label_id"])
                if not name:
                    continue

                pts = a["points"]
                xs = pts[0::2]; ys = pts[1::2]
                obj = SubElement(root, "object")
                SubElement(obj, "name").text = name
                SubElement(obj, "pose").text = "Unspecified"
                SubElement(obj, "truncated").text = "0"
                SubElement(obj, "difficult").text = "1" if a.get("occluded") else "0"

                bnd = SubElement(obj, "bndbox")
                SubElement(bnd, "xmin").text = str(int(min(xs)))
                SubElement(bnd, "ymin").text = str(int(min(ys)))
                SubElement(bnd, "xmax").text = str(int(max(xs)))
                SubElement(bnd, "ymax").text = str(int(max(ys)))

            base = os.path.splitext(img["filename"])[0]
            ElementTree(root).write(
                os.path.join(ann_dir, f"{base}.xml"),
                encoding="utf-8", xml_declaration=True,
            )


register(VOCExporter())
