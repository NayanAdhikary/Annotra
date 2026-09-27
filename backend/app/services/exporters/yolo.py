import os
from app.services.exporters.base import Exporter, ExportContext, register


class YOLOExporter(Exporter):
    """
    YOLO format placeholder since Task 16.5 was not provided in the prompt.
    """
    name = "yolo"
    file_extension = ".txt"

    def write(self, output_dir: str, ctx: ExportContext) -> None:
        pass


register(YOLOExporter())
