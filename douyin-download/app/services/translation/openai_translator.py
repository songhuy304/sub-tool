import os
import json
import logging
from typing import List, Optional
from app.services.translation.base import BaseTranslationProvider
from app.services.translation.google_translator import GoogleTranslator
from app.schemas.subtitle import SubtitleSegment, TranslationResult

logger = logging.getLogger(__name__)


class OpenAITranslator(BaseTranslationProvider):
    """Translation provider sử dụng OpenAI API cho kết quả dịch ngữ cảnh tự nhiên."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini"
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.fallback = GoogleTranslator()

    def translate_segments(
        self,
        segments: List[SubtitleSegment],
        source_lang: str = "zh",
        target_lang: str = "vi"
    ) -> TranslationResult:
        if not segments:
            return TranslationResult(segments=[], source_lang=source_lang, target_lang=target_lang)

        if not self.api_key:
            logger.warning("OPENAI_API_KEY không được thiết lập. Tự động chuyển sang GoogleTranslator.")
            return self.fallback.translate_segments(segments, source_lang, target_lang)

        try:
            import requests
        except ImportError:
            logger.warning("Thư viện `requests` chưa có. Chuyển sang GoogleTranslator.")
            return self.fallback.translate_segments(segments, source_lang, target_lang)

        # Gom danh sách text để gửi trong 1 prompt nhằm tiết kiệm token & duy trì ngữ cảnh giữa các câu
        lines_input = [{"id": idx, "text": seg.text} for idx, seg in enumerate(segments)]

        prompt_system = (
            f"Bạn là chuyên gia dịch phụ đề video ngắn. "
            f"Dịch từ {source_lang} sang {target_lang}. "
            f"Văn phong tự nhiên, ngắn gọn, đúng ngữ cảnh phụ đề Douyin/TikTok. "
            f"Không giữ chữ Trung trừ tên riêng. Không pinyin. "
            f"Trả về JSON object: {{\"items\": [{{\"id\": 0, \"translated_text\": \"...\"}}]}}."
        )

        prompt_user = json.dumps(lines_input, ensure_ascii=False)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": prompt_user}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3
        }

        try:
            logger.info(f"Calling OpenAI API ({self.model}) to translate {len(segments)} segments...")
            res = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=90
            )

            if res.status_code != 200:
                logger.error(f"OpenAI API Error ({res.status_code}): {res.text}")
                return self.fallback.translate_segments(segments, source_lang, target_lang)

            res_data = res.json()
            content_str = res_data["choices"][0]["message"]["content"]
            parsed_content = json.loads(content_str)

            if isinstance(parsed_content, list):
                items = parsed_content
            elif isinstance(parsed_content, dict):
                maybe_items = parsed_content.get("items") or parsed_content.get("translations")
                items = maybe_items if isinstance(maybe_items, list) else []
            else:
                items = []

            # Map bản dịch lại theo id
            trans_map = {}
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and "id" in item and "translated_text" in item:
                        trans_map[int(item["id"])] = item["translated_text"]

            translated_segments = []
            for idx, seg in enumerate(segments):
                translated_text = trans_map.get(idx, seg.text)
                translated_segments.append(
                    SubtitleSegment(
                        start=seg.start,
                        end=seg.end,
                        text=seg.text,
                        translated_text=translated_text,
                        speaker=seg.speaker,
                        confidence=seg.confidence
                    )
                )

            logger.info("OpenAI Translation completed successfully.")
            return TranslationResult(
                segments=translated_segments,
                source_lang=source_lang,
                target_lang=target_lang
            )

        except Exception as e:
            logger.error(f"Exception while translating with OpenAI: {e}")
            return self.fallback.translate_segments(segments, source_lang, target_lang)
