import re
from typing import List
from app.schemas.subtitle import SubtitleSegment

_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_VI_RE = re.compile(
    r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
    re.IGNORECASE,
)


def looks_untranslated(text: str) -> bool:
    """True nếu chuỗi vẫn là tiếng Trung / fallback giả lập, chưa phải tiếng Việt."""
    if not text or not text.strip():
        return True
    stripped = text.strip()
    if stripped.startswith("[Dịch-"):
        return True
    return bool(_CJK_RE.search(stripped)) and not bool(_VI_RE.search(stripped))


def majority_untranslated(segments: List[SubtitleSegment], threshold: float = 0.5) -> bool:
    if not segments:
        return False
    flags = []
    for seg in segments:
        shown = seg.translated_text if seg.translated_text else seg.text
        flags.append(looks_untranslated(shown or ""))
    return (sum(flags) / len(flags)) >= threshold
