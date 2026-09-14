from abc import ABC, abstractmethod
from typing import List
from app.schemas.subtitle import SubtitleSegment, TranslationResult


class BaseTranslationProvider(ABC):
    """Interface trừu tượng cho dịch vụ dịch thuật phụ đề (Translation Provider)."""

    @abstractmethod
    def translate_segments(
        self,
        segments: List[SubtitleSegment],
        source_lang: str = "zh",
        target_lang: str = "vi"
    ) -> TranslationResult:
        """Dịch danh sách các đoạn phụ đề sang ngôn ngữ đích.

        Args:
            segments: Danh sách SubtitleSegment bản gốc.
            source_lang: Ngôn ngữ nguồn (mặc định 'zh').
            target_lang: Ngôn ngữ đích (mặc định 'vi').

        Returns:
            TranslationResult chứa các segment đã gắn `translated_text`.
        """
        pass
