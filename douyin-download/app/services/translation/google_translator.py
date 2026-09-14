import logging
import time
from typing import List, Optional
from app.services.translation.base import BaseTranslationProvider
from app.schemas.subtitle import SubtitleSegment, TranslationResult

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


class GoogleTranslator(BaseTranslationProvider):
    """Dịch phụ đề qua Google Translate, fallback MyMemory khi bị giới hạn."""

    GOOGLE_ENDPOINT = "https://translate.googleapis.com/translate_a/single"
    MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get"
    CHUNK_SIZE = 8

    def translate_segments(
        self,
        segments: List[SubtitleSegment],
        source_lang: str = "zh",
        target_lang: str = "vi"
    ) -> TranslationResult:
        if not segments:
            return TranslationResult(segments=[], source_lang=source_lang, target_lang=target_lang)

        try:
            import requests
        except ImportError:
            logger.warning("Thư viện `requests` chưa có. Giữ nguyên văn bản gốc.")
            return TranslationResult(segments=list(segments), source_lang=source_lang, target_lang=target_lang)

        sl = "zh-CN" if source_lang.lower().startswith("zh") else source_lang
        texts = [seg.text or "" for seg in segments]
        translated_lines = self._translate_many(requests, texts, sl, target_lang)

        translated_segments = []
        for seg, translated in zip(segments, translated_lines):
            translated_segments.append(
                SubtitleSegment(
                    start=seg.start,
                    end=seg.end,
                    text=seg.text,
                    translated_text=(translated or seg.text).strip(),
                    speaker=seg.speaker,
                    confidence=seg.confidence
                )
            )

        logger.info("HTTP translation completed.")
        return TranslationResult(
            segments=translated_segments,
            source_lang=source_lang,
            target_lang=target_lang
        )

    def _translate_many(self, requests, texts: List[str], sl: str, tl: str) -> List[str]:
        results: List[Optional[str]] = [None] * len(texts)
        for start in range(0, len(texts), self.CHUNK_SIZE):
            chunk = texts[start:start + self.CHUNK_SIZE]
            joined = "\n".join(chunk)
            try:
                translated = self._translate_text(requests, joined, sl, tl)
                lines = translated.split("\n")
                if len(lines) == len(chunk):
                    for offset, line in enumerate(lines):
                        results[start + offset] = line
                else:
                    raise ValueError("line count mismatch")
            except Exception as e:
                logger.warning(f"Chunk translate failed, falling back per-line: {e}")
                for offset, text in enumerate(chunk):
                    try:
                        results[start + offset] = self._translate_text(requests, text, sl, tl)
                    except Exception as err:
                        logger.warning(f"Line translate failed: {err}")
                        results[start + offset] = text
            if start + self.CHUNK_SIZE < len(texts):
                time.sleep(0.2)

        return [item if item is not None else texts[idx] for idx, item in enumerate(results)]

    def _translate_text(self, requests, text: str, sl: str, tl: str) -> str:
        if not text or not text.strip():
            return text
        last_error = None
        for attempt in range(3):
            try:
                return self._google_translate(requests, text, sl, tl)
            except Exception as e:
                last_error = e
                if "429" in str(e):
                    time.sleep(1.2 * (attempt + 1))
                    continue
                break
        logger.warning(f"Google Translate unavailable ({last_error}), trying MyMemory...")
        return self._mymemory_translate(requests, text, sl, tl)

    def _google_translate(self, requests, text: str, sl: str, tl: str) -> str:
        response = requests.get(
            self.GOOGLE_ENDPOINT,
            params={"client": "gtx", "sl": sl, "tl": tl, "dt": "t", "q": text},
            headers=_HEADERS,
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
        parts = []
        if isinstance(data, list) and data and isinstance(data[0], list):
            for item in data[0]:
                if item and item[0]:
                    parts.append(item[0])
        result = "".join(parts).strip()
        if not result:
            raise ValueError("empty Google translation")
        return result

    def _mymemory_translate(self, requests, text: str, sl: str, tl: str) -> str:
        response = requests.get(
            self.MYMEMORY_ENDPOINT,
            params={"q": text[:450], "langpair": f"{sl}|{tl}"},
            headers=_HEADERS,
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
        result = ((data or {}).get("responseData") or {}).get("translatedText") or ""
        result = str(result).strip()
        if not result or result.upper() == "NO QUERY SPECIFIED":
            raise ValueError("empty MyMemory translation")
        return result
