import json
import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass


@dataclass
class ParsedAnnotation:
    filename: str        # original image filename
    shape_type: str
    points: list[float]
    external_label: str
    frame: int = 0
    occluded: bool = False
    attributes: list = None


@dataclass
class ParsedDataset:
    annotations: list[ParsedAnnotation]
    external_labels: set[str]     # distinct labels found in the file
    image_files: list[str]        # filenames referenced


def parse_coco(path: str) -> ParsedDataset:
    with open(path) as f:
        data = json.load(f)

    categories = {c["id"]: c["name"] for c in data.get("categories", [])}
    images = {i["id"]: i["file_name"] for i in data.get("images", [])}

    out: list[ParsedAnnotation] = []
    labels: set[str] = set()

    for a in data.get("annotations", []):
        label = categories.get(a["category_id"], "unknown")
        labels.add(label)
        img_name = images.get(a["image_id"], "")

        if "bbox" in a and len(a["bbox"]) == 4:
            x, y, w, h = a["bbox"]
            out.append(ParsedAnnotation(
                filename=img_name, shape_type="rectangle",
                points=[x, y, x + w, y + h], external_label=label,
            ))
        elif a.get("segmentation") and isinstance(a["segmentation"], list):
            for seg in a["segmentation"]:
                if isinstance(seg, list) and len(seg) >= 6:
                    out.append(ParsedAnnotation(
                        filename=img_name, shape_type="polygon",
                        points=list(seg), external_label=label,
                    ))
                    break

    return ParsedDataset(out, labels, list(images.values()))


def parse_yolo(images_dir: str, labels_dir: str, classes_path: str) -> ParsedDataset:
    with open(classes_path) as f:
        class_names = [line.strip() for line in f if line.strip()]

    out: list[ParsedAnnotation] = []
    labels: set[str] = set(class_names)
    image_files: list[str] = []

    # Need image dimensions to denormalize. Read them with PIL.
    from PIL import Image as PILImage

    for entry in sorted(os.listdir(images_dir)):
        if not entry.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp")):
            continue
        image_files.append(entry)
        img_path = os.path.join(images_dir, entry)
        try:
            w, h = PILImage.open(img_path).size
        except Exception:
            continue

        base = os.path.splitext(entry)[0]
        txt_path = os.path.join(labels_dir, f"{base}.txt")
        if not os.path.exists(txt_path):
            continue

        with open(txt_path) as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) != 5:
                    continue
                cls_idx = int(parts[0])
                cx, cy, bw, bh = map(float, parts[1:])
                x = (cx - bw / 2) * w
                y = (cy - bh / 2) * h
                out.append(ParsedAnnotation(
                    filename=entry, shape_type="rectangle",
                    points=[x, y, x + bw * w, y + bh * h],
                    external_label=class_names[cls_idx] if cls_idx < len(class_names) else "unknown",
                ))

    return ParsedDataset(out, labels, image_files)


def parse_voc(annotations_dir: str) -> ParsedDataset:
    out: list[ParsedAnnotation] = []
    labels: set[str] = set()
    image_files: list[str] = []

    for fn in os.listdir(annotations_dir):
        if not fn.endswith(".xml"):
            continue
        tree = ET.parse(os.path.join(annotations_dir, fn))
        root = tree.getroot()

        fname_el = root.find("filename")
        fname = fname_el.text if fname_el is not None else fn.replace(".xml", ".jpg")
        image_files.append(fname)

        for obj in root.findall("object"):
            name_el = obj.find("name")
            name = name_el.text if name_el is not None else "unknown"
            labels.add(name)

            bnd = obj.find("bndbox")
            if bnd is None:
                continue
            xmin = float(bnd.findtext("xmin") or 0)
            ymin = float(bnd.findtext("ymin") or 0)
            xmax = float(bnd.findtext("xmax") or 0)
            ymax = float(bnd.findtext("ymax") or 0)
            out.append(ParsedAnnotation(
                filename=fname, shape_type="rectangle",
                points=[xmin, ymin, xmax, ymax], external_label=name,
            ))

    return ParsedDataset(out, labels, image_files)


def parse_cvat(path: str) -> ParsedDataset:
    tree = ET.parse(path)
    root = tree.getroot()

    images = {el.get("id"): el.get("name") for el in root.findall("image")}
    out: list[ParsedAnnotation] = []
    labels: set[str] = set()
    image_files = list(images.values())

    # Loose shapes inside <image>
    for img_el in root.findall("image"):
        fname = img_el.get("name")
        for shape in list(img_el):
            label = shape.get("label", "unknown")
            labels.add(label)
            st = _cvat_shape_to_parsed(shape, fname, label)
            if st:
                out.append(st)

    # Tracks
    for track in root.findall("track"):
        label = track.get("label", "unknown")
        labels.add(label)
        for shape in list(track):
            frame = int(shape.get("frame", "0"))
            fname = next((v for k, v in images.items()), None)
            if not fname:
                continue
            st = _cvat_shape_to_parsed(shape, fname, label, frame)
            if st:
                out.append(st)

    return ParsedDataset(out, labels, image_files)


def _cvat_shape_to_parsed(shape, filename: str, label: str, frame: int = 0):
    tag = shape.tag
    occluded = shape.get("occluded", "0") == "1"
    if tag == "box":
        x1 = float(shape.get("xtl", 0))
        y1 = float(shape.get("ytl", 0))
        x2 = float(shape.get("xbr", 0))
        y2 = float(shape.get("ybr", 0))
        return ParsedAnnotation(filename=filename, shape_type="rectangle",
                                points=[x1, y1, x2, y2], external_label=label,
                                frame=frame, occluded=occluded)
    if tag in ("polygon", "polyline"):
        pts = shape.get("points", "")
        coords = []
        for pair in pts.split(";"):
            if not pair: continue
            x, y = pair.split(",")
            coords.extend([float(x), float(y)])
        if len(coords) >= 4:
            return ParsedAnnotation(
                filename=filename,
                shape_type="polygon" if tag == "polygon" else "polyline",
                points=coords, external_label=label,
                frame=frame, occluded=occluded,
            )
    if tag == "points":
        pts = shape.get("points", "")
        coords = []
        for pair in pts.split(";"):
            if not pair: continue
            x, y = pair.split(",")
            coords.extend([float(x), float(y)])
        return ParsedAnnotation(filename=filename, shape_type="points",
                                points=coords, external_label=label,
                                frame=frame, occluded=occluded)
    return None


def detect_format(upload_dir: str) -> str:
    """
    Guess the format from the contents of the uploaded archive.
    """
    if os.path.exists(os.path.join(upload_dir, "annotations.json")):
        return "coco"
    if os.path.exists(os.path.join(upload_dir, "annotations.xml")):
        return "cvat"
    if os.path.exists(os.path.join(upload_dir, "classes.txt")):
        return "yolo"
    for root, _, files in os.walk(upload_dir):
        for f in files:
            if f.endswith(".xml"):
                return "voc"
    raise ValueError("Could not detect dataset format")
