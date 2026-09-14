import logging
import os
from typing import Optional
from app.services.speech.base import BaseSpeechRecognizer
from app.schemas.subtitle import SubtitleSegment, TranscriptionResult

logger = logging.getLogger(__name__)


class FasterWhisperRecognizer(BaseSpeechRecognizer):
    """Speech Recognizer triển khai sử dụng thư viện `faster-whisper`."""

    def __init__(
        self,
        model_size: str = "small",
        device: str = "cpu",
        compute_type: str = "int8",
        allow_mock: bool = False,
        beam_size: int = 1,
    ):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.allow_mock = allow_mock
        self.beam_size = beam_size
        self.model = None

    def _load_model(self):
        """Khởi tạo model lazy-loading."""
        if self.model is not None:
            return

        if self.allow_mock:
            self.model = "MOCK"
            return

        try:
            from faster_whisper import WhisperModel
            logger.info(f"Loading faster-whisper model: {self.model_size} on {self.device} ({self.compute_type})")
            self.model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type
            )
            logger.info("faster-whisper model loaded successfully.")
        except ImportError:
            if not self.allow_mock:
                raise RuntimeError(
                    "Chưa cài faster-whisper nên không nhận được giọng nói thật. "
                    "Chạy: pip install faster-whisper"
                )
            logger.warning("Thư viện `faster-whisper` chưa được cài đặt. Sẽ kích hoạt chế độ Fallback STT.")
            self.model = "MOCK"

    def transcribe(
        self,
        audio_path: str,
        language: str = "zh"
    ) -> TranscriptionResult:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        self._load_model()

        if self.model == "MOCK":
            logger.info("Using Fallback STT Transcriber.")
            # Trả về dữ liệu thử nghiệm giả lập khi chưa cài faster-whisper package
            segments = [
                SubtitleSegment(start=0.5, end=3.0, text="大家好，欢迎来到 Douyin Tool", confidence=0.95),
                SubtitleSegment(start=3.2, end=6.5, text=",今天, 给大家, 介绍, 一个, 自动, 生成, 字幕, 的, 工具", confidence=0.92),
                SubtitleSegment(start=7.0, end=10.0, text=",希望, 大家, 喜欢, 这个, 功能", confidence=0.88),
            ]
            return TranscriptionResult(
                segments=segments,
                language=language,
                duration=10.0
            )

        # Chạy transcriber thật bằng faster-whisper
        segments_raw, info = self.model.transcribe(
            audio_path,
            language=language,
            beam_size=self.beam_size,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        segments = []
        for s in segments_raw:
            text = s.text.strip()
            if text:
                segments.append(
                    SubtitleSegment(
                        start=round(s.start, 2),
                        end=round(s.end, 2),
                        text=text,
                        confidence=round(s.avg_logprob, 2)
                    )
                )

        return TranscriptionResult(
            segments=segments,
            language=info.language if info else language,
            duration=round(info.duration, 2) if info else 0.0
        )
