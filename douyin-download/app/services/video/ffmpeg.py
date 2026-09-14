import json
import os
import shutil
import subprocess
import tempfile
import logging
from typing import Dict, Any, Optional

from app.services.removal.blur import BlurSubtitleRemover

logger = logging.getLogger(__name__)


class FFmpegService:
    """Service chịu trách nhiệm giao tiếp với FFmpeg và FFprobe."""

    def __init__(self, ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe"):
        self.ffmpeg_path = ffmpeg_path
        self.ffprobe_path = ffprobe_path

    def _run(self, cmd, cwd: Optional[str] = None) -> subprocess.CompletedProcess:
        return subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=True,
            cwd=cwd,
        )

    def probe(self, video_path: str) -> Dict[str, Any]:
        """Lấy thông tin chi tiết về file video sử dụng ffprobe."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cmd = [
            self.ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            video_path
        ]

        try:
            result = self._run(cmd)
            data = json.loads(result.stdout)

            format_info = data.get("format", {})
            streams = data.get("streams", [])

            duration = float(format_info.get("duration", 0.0))
            video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
            audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

            width = int(video_stream.get("width", 0)) if video_stream else 0
            height = int(video_stream.get("height", 0)) if video_stream else 0
            fps_raw = video_stream.get("r_frame_rate", "0/1") if video_stream else "0/1"
            try:
                if isinstance(fps_raw, str) and "/" in fps_raw:
                    num, den = fps_raw.split("/", 1)
                    fps = float(num) / float(den) if float(den) != 0 else 0.0
                else:
                    fps = float(fps_raw)
            except (ValueError, ZeroDivisionError):
                fps = 0.0

            return {
                "duration": duration,
                "width": width,
                "height": height,
                "fps": float(fps),
                "has_video": video_stream is not None,
                "has_audio": audio_stream is not None,
                "video_codec": video_stream.get("codec_name") if video_stream else None,
                "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
            }
        except subprocess.CalledProcessError as e:
            logger.error(f"FFprobe failed for {video_path}: {e.stderr}")
            raise RuntimeError(f"FFprobe failed: {e.stderr}")
        except Exception as e:
            logger.error(f"Error probing video {video_path}: {e}")
            raise

    def extract_audio(
        self,
        video_path: str,
        output_wav_path: str,
        sample_rate: int = 16000,
        channels: int = 1
    ) -> str:
        """Trích xuất âm thanh từ video sang định dạng WAV (PCM 16-bit mono 16kHz)."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Input video not found: {video_path}")

        os.makedirs(os.path.dirname(os.path.abspath(output_wav_path)), exist_ok=True)

        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", video_path,
            "-vn",
            "-threads", "0",
            "-acodec", "pcm_s16le",
            "-ar", str(sample_rate),
            "-ac", str(channels),
            output_wav_path
        ]

        logger.info(f"Extracting audio from {video_path} -> {output_wav_path}")
        try:
            self._run(cmd)
            logger.info("Audio extraction completed successfully.")
            return output_wav_path
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg audio extraction failed: {e.stderr}")
            raise RuntimeError(f"FFmpeg audio extraction failed: {e.stderr}")

    def burn_subtitle(
        self,
        video_path: str,
        subtitle_ass_path: str,
        output_video_path: str,
        preset: str = "veryfast",
        crf: int = 23,
        blur_original: bool = False,
        video_width: int = 0,
        video_height: int = 0,
        **kwargs
    ) -> str:
        """Gắn (burn hardcode) phụ đề ASS vào video, tùy chọn làm mờ phụ đề gốc."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        if not os.path.exists(subtitle_ass_path):
            raise FileNotFoundError(f"Subtitle file not found: {subtitle_ass_path}")

        os.makedirs(os.path.dirname(os.path.abspath(output_video_path)), exist_ok=True)

        abs_video = os.path.abspath(video_path)
        abs_output = os.path.abspath(output_video_path)

        # Dùng tên file ASS ASCII + cwd temp để tránh lỗi escape ổ đĩa Windows (C:)
        work_dir = tempfile.mkdtemp(prefix="ffburn_")
        try:
            local_ass = os.path.join(work_dir, "sub.ass")
            shutil.copy(subtitle_ass_path, local_ass)

            encode_args = [
                "-c:v", "libx264",
                "-preset", preset,
                "-crf", str(crf),
                "-threads", "0",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                abs_output,
            ]

            last_error = ""
            attempts = []

            if blur_original and video_width > 0 and video_height > 0:
                remover = BlurSubtitleRemover()
                filter_complex = remover.build_filter_complex(video_width, video_height, "sub.ass")
                attempts.append([
                    self.ffmpeg_path, "-y", "-i", abs_video,
                    "-filter_complex", filter_complex,
                    "-map", "[vout]", "-map", "0:a?",
                    *encode_args,
                ])

            attempts.append([
                self.ffmpeg_path, "-y", "-i", abs_video,
                "-vf", "ass=sub.ass",
                *encode_args,
            ])
            attempts.append([
                self.ffmpeg_path, "-y", "-i", abs_video,
                "-vf", "subtitles=sub.ass",
                *encode_args,
            ])

            logger.info(f"Burning subtitle onto video: {abs_output}")
            for idx, cmd in enumerate(attempts):
                try:
                    self._run(cmd, cwd=work_dir)
                    logger.info("Subtitle burning completed successfully.")
                    return abs_output
                except subprocess.CalledProcessError as e:
                    last_error = e.stderr or str(e)
                    logger.warning(f"FFmpeg burn attempt {idx + 1}/{len(attempts)} failed: {last_error[-500:]}")

            raise RuntimeError(f"FFmpeg subtitle burning failed: {last_error}")
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)
