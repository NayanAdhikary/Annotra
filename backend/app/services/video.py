import json
import os
import shutil
import subprocess
from dataclasses import dataclass


@dataclass
class VideoMetadata:
    duration_sec: float
    fps: float
    total_frames: int
    width: int
    height: int


def probe_video(path: str) -> VideoMetadata:
    if not shutil.which("ffprobe"):
        raise RuntimeError("ffprobe not installed")

    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration,nb_frames",
        "-of", "json",
        path,
    ]
    out = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode()
    data = json.loads(out)
    stream = data["streams"][0]

    width = int(stream.get("width", 0))
    height = int(stream.get("height", 0))

    rate = stream.get("r_frame_rate", "0/1")
    try:
        num, den = rate.split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    except Exception:
        fps = 0.0

    duration = float(stream.get("duration", 0))
    nb = stream.get("nb_frames")
    total_frames = int(nb) if nb and nb.isdigit() else (int(duration * fps) if fps else 0)

    return VideoMetadata(duration, fps, total_frames, width, height)


def extract_frames(
    video_path: str,
    output_dir: str,
    fps: float | None = None,
    jpeg_quality: int = 3,
) -> int:
    """
    Extract frames as JPEGs. Atomic — writes to a tmp dir first, renames on success.
    """
    os.makedirs(os.path.dirname(output_dir), exist_ok=True)
    tmp_dir = output_dir + ".tmp"
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)

    cmd = ["ffmpeg", "-y", "-i", video_path]
    if fps is not None:
        cmd += ["-vf", f"fps={fps}"]
    cmd += ["-q:v", str(jpeg_quality), os.path.join(tmp_dir, "frame_%06d.jpg")]

    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
    )
    for _ in proc.stdout or []:
        pass
    proc.wait()

    if proc.returncode != 0:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError(f"ffmpeg exited with {proc.returncode}")

    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.rename(tmp_dir, output_dir)

    return len([f for f in os.listdir(output_dir) if f.endswith(".jpg")])