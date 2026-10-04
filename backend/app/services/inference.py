"""
YOLOv8 inference. Loads the model once per worker process and caches it.
No DB, no globals beyond the model cache.
"""
import os
import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)

# Per-process cache. Cleared when the worker recycles (max_tasks_per_child).
_MODEL_CACHE: dict[str, object] = {}


@dataclass
class Detection:
    class_id: int
    class_name: str
    confidence: float
    points: List[float]     # [x1,y1,x2,y2] for det, flat polygon for seg
    shape_type: str         # "rectangle" | "polygon"


def load_model(model_path: str):
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    if model_path in _MODEL_CACHE:
        return _MODEL_CACHE[model_path]

    from ultralytics import YOLO
    model = YOLO(model_path)
    _MODEL_CACHE[model_path] = model
    return model


def model_class_names(model_path: str) -> list[str]:
    model = load_model(model_path)
    names = getattr(model, "names", {}) or {}
    if isinstance(names, dict):
        return [names[i] for i in sorted(names.keys())]
    return list(names)


def model_kind(model_path: str) -> str:
    model = load_model(model_path)
    task = getattr(model, "task", None)
    return "yolov8_seg" if task == "segment" else "yolov8_det"


def run_inference(
    model_path: str,
    image_path: str,
    confidence: float = 0.25,
    iou: float = 0.45,
) -> List[Detection]:
    model = load_model(model_path)

    try:
        results = model.predict(
            source=image_path,
            conf=confidence,
            iou=iou,
            verbose=False,
            save=False,
        )
    except Exception as e:
        logger.warning("inference failed on %s: %s", image_path, e)
        return []

    detections: List[Detection] = []
    for r in results:
        names = r.names  # {class_id: name}
        is_seg = getattr(r, "masks", None) is not None

        if is_seg:
            for i, box in enumerate(r.boxes):
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                mask_tensor = r.masks.data[i]
                pts = _mask_to_polygon(mask_tensor)
                if pts:
                    detections.append(Detection(
                        class_id=cls_id,
                        class_name=names.get(cls_id, f"class_{cls_id}"),
                        confidence=conf,
                        points=pts,
                        shape_type="polygon",
                    ))
        else:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(Detection(
                    class_id=cls_id,
                    class_name=names.get(cls_id, f"class_{cls_id}"),
                    confidence=conf,
                    points=[float(x1), float(y1), float(x2), float(y2)],
                    shape_type="rectangle",
                ))

    return detections


def _mask_to_polygon(mask_tensor) -> Optional[List[float]]:
    try:
        import cv2


        mask = mask_tensor.cpu().numpy().astype("uint8")
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
        best = max(contours, key=cv2.contourArea)
        approx = cv2.approxPolyDP(best, 1.5, True)
        if len(approx) < 3:
            return None
        pts: List[float] = []
        for p in approx:
            pts.extend([float(p[0][0]), float(p[0][1])])
        return pts
    except Exception as e:
        logger.warning("mask-to-polygon failed: %s", e)
        return None
