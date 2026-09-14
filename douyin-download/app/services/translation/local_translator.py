import logging
from typing import List, Dict
from app.services.translation.base import BaseTranslationProvider
from app.schemas.subtitle import SubtitleSegment, TranslationResult

logger = logging.getLogger(__name__)


class LocalFallbackTranslator(BaseTranslationProvider):
    """Translation provider sử dụng từ điển quy tắc đơn giản / offline cho testing và fallback."""

    DICTIONARY_ZH_VI: Dict[str, str] = {
        "大家好，欢迎来到 Douyin Tool": "Xin chào mọi người, chào mừng đến với Douyin Tool",
        "今天, 给大家, 介绍, 一个, 自动, 生成, 字幕, 的, 工具": "Hôm nay, xin giới thiệu với mọi người một công cụ tự động tạo phụ đề",
        "希望, 大家, 喜欢, 这个, 功能": "Hy vọng mọi người sẽ thích tính năng này",
        "大家好": "Xin chào mọi người",
        "谢谢": "Cảm ơn",
        "再见": "Tạm biệt",
        "你好": "Xin chào",
    }

    def translate_segments(
        self,
        segments: List[SubtitleSegment],
        source_lang: str = "zh",
        target_lang: str = "vi"
    ) -> TranslationResult:
        logger.info(f"LocalFallbackTranslator: translating {len(segments)} segments ({source_lang} -> {target_lang})")
        
        translated_segments: List[SubtitleSegment] = []
        for seg in segments:
            # Sao chép segment và điền nội dung đã dịch
            translated_text = self.DICTIONARY_ZH_VI.get(seg.text.strip())
            if not translated_text:
                # Nếu không có trong từ điển mẫu, tạo bản dịch đơn giản giữ nguyên hoặc gắn mốc giả lập
                translated_text = f"[Dịch-{target_lang}]: {seg.text}"

            new_seg = SubtitleSegment(
                start=seg.start,
                end=seg.end,
                text=seg.text,
                translated_text=translated_text,
                speaker=seg.speaker,
                confidence=seg.confidence
            )
            translated_segments.append(new_seg)

        return TranslationResult(
            segments=translated_segments,
            source_lang=source_lang,
            target_lang=target_lang
        )
