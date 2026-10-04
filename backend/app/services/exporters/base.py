from abc import ABC, abstractmethod
from dataclasses import dataclass, field



@dataclass
class ExportContext:
    task_id: int
    task_name: str
    task_type: str                              # "image" | "video"
    images: list[dict]                          # [{id, filename, width, height, storage_path, frame}]
    annotations: list[dict]                     # see annotation_to_dict below
    labels: list[dict]                          # [{id, name, color}]
    videos: list[dict] = field(default_factory=list)  # [{id, filename, fps, frames_dir}]
    include_images: bool = True


class Exporter(ABC):
    name: str = ""
    supports_video: bool = False

    @abstractmethod
    def write(self, output_dir: str, ctx: ExportContext) -> None: ...


EXPORTERS: dict[str, Exporter] = {}


def register(exporter: Exporter) -> None:
    EXPORTERS[exporter.name] = exporter


def get_exporter(name: str) -> Exporter:
    if name not in EXPORTERS:
        raise ValueError(f"Unknown export format: {name}")
    return EXPORTERS[name]