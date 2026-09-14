import re
from dataclasses import dataclass
from pathlib import Path

from app.core.config import Settings


_UNSAFE_RE = re.compile(r"[^\w\u4e00-\u9fff\-]+", re.UNICODE)


def safe_filename(value: str, fallback: str = "video", max_len: int = 40) -> str:
    text = (value or "").strip()
    text = _UNSAFE_RE.sub("_", text).strip("._")
    if not text:
        text = fallback
    return text[:max_len]


def public_filename(title: str | None, job_id: str, suffix: str = ".mp4") -> str:
    base = safe_filename(title or "", fallback=f"douyin_{job_id[:8]}")
    return f"{base}{suffix}"


@dataclass(frozen=True)
class JobPaths:
    temp_dir: Path
    input_path: Path
    audio_path: Path
    ass_path: Path
    output_path: Path
    subtitle_path: Path


def job_paths(settings: Settings, job_id: str) -> JobPaths:
    temp_dir = settings.temp_dir / job_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    return JobPaths(
        temp_dir=temp_dir,
        input_path=temp_dir / "input.mp4",
        audio_path=temp_dir / "audio.wav",
        ass_path=temp_dir / "subtitle.ass",
        output_path=settings.outputs_dir / f"{job_id}.mp4",
        subtitle_path=settings.subtitles_dir / f"{job_id}.ass",
    )
