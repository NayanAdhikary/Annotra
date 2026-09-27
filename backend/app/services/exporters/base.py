from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ExportContext:
    """
    Everything an exporter needs. Passed by the worker so exporters are pure
    functions — no DB, no filesystem access except to read image paths.
    """
    task_id: int
    task_name: str
    images: list[dict]        # [{id, filename, width, height, storage_path, frame}]
    annotations: list[dict]   # [{id, image_id, frame, label_id, shape_type, points, occluded, attributes, track_id, is_keyframe}]
    labels: list[dict]        # [{id, name, color}]
    include_images: bool


class Exporter(ABC):
    """
    Implement `write(output_dir, ctx)` to produce files inside `output_dir`.
    The worker handles zipping.
    """

    name: str = ""              # "coco", "yolo", "voc", "cvat"
    file_extension: str = ""    # ".json" for COCO/CVAT, ".xml" for VOC, per-image .txt for YOLO

    @abstractmethod
    def write(self, output_dir: str, ctx: ExportContext) -> None:
        ...


# Registry — exporters self-register by format name
EXPORTERS: dict[str, Exporter] = {}


def register(exporter: Exporter) -> None:
    EXPORTERS[exporter.name] = exporter


def get_exporter(name: str) -> Exporter:
    if name not in EXPORTERS:
        raise ValueError(f"Unknown export format: {name}")
    return EXPORTERS[name]
