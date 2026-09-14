from abc import ABC, abstractmethod
from app.schemas.subtitle import TranscriptionResult


class BaseSpeechRecognizer(ABC):
    """Interface trừu tượng cho dịch vụ Speech-to-Text (STT)."""

    @abstractmethod
    def transcribe(
        self,
        audio_path: str,
        language: str = "zh"
    ) -> TranscriptionResult:
        """Chuyển âm thanh thành danh sách các segment phụ đề kèm mốc thời gian.

        Args:
            audio_path: Đường dẫn file audio (WAV).
            language: Mã ngôn ngữ (mặc định 'zh').

        Returns:
            TranscriptionResult chứa danh sách SubtitleSegment.
        """
        pass
