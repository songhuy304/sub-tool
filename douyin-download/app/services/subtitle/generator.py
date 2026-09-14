import os
import copy
import textwrap
import logging
from typing import List, Optional
from app.schemas.subtitle import SubtitleSegment, SubtitleStyleConfig
from app.services.subtitle.ass_builder import ASSBuilder

logger = logging.getLogger(__name__)


def resolve_style_for_resolution(
    style: SubtitleStyleConfig,
    width: int,
    height: int
) -> SubtitleStyleConfig:
    """Tính font/margin phù hợp video dọc HD (PlayRes = kích thước thật)."""
    resolved = copy.deepcopy(style)
    h = height if height and height > 0 else 1920

    if not resolved.font_size or resolved.font_size <= 0:
        # ~5% chiều cao: 1080x1440 → 72px, đủ lớn trên điện thoại
        resolved.font_size = max(60, int(round(h * 0.046)))
    if not resolved.margin_v or resolved.margin_v <= 0:
        resolved.margin_v = max(80, int(round(h * 0.08)))
    if resolved.outline_width <= 2.0:
        resolved.outline_width = round(max(3.5, resolved.font_size / 18.0), 1)
    if resolved.shadow_width < 2.0:
        resolved.shadow_width = 2.0
    if resolved.margin_l < 40:
        resolved.margin_l = 50
    if resolved.margin_r < 40:
        resolved.margin_r = 50
    return resolved


class SubtitleGenerator:
    """Xử lý tối ưu thời gian hiển thị, ngắt dòng thông minh và xuất file phụ đề ASS."""

    def __init__(self, style: Optional[SubtitleStyleConfig] = None):
        self.style = style if style is not None else SubtitleStyleConfig()

    def wrap_text(self, text: str, max_chars: int = 35, max_lines: int = 2) -> str:
        """Tự động ngắt dòng thông minh cho văn bản phụ đề."""
        if not text:
            return ""

        # Nếu văn bản đã có sẵn ngắt dòng thủ công
        if "\n" in text:
            lines = text.split("\n")
            return "\n".join(lines[:max_lines])

        if len(text) <= max_chars:
            return text

        wrapped = textwrap.wrap(text, width=max_chars, break_long_words=False)
        if len(wrapped) <= max_lines:
            return "\n".join(wrapped)

        words = text.split()
        if len(words) >= 2 and max_lines == 2:
            mid = max(1, (len(words) + 1) // 2)
            return " ".join(words[:mid]) + "\n" + " ".join(words[mid:])

        line1 = wrapped[0]
        line2 = " ".join(wrapped[1:])
        return f"{line1}\n{line2}"

    def optimize_segments(self, segments: List[SubtitleSegment]) -> List[SubtitleSegment]:
        """Tối ưu hóa các mốc thời gian của phụ đề:
        - Đảm bảo thời gian hiển thị tối thiểu (min_duration = 0.8s)
        - Đảm bảo thời gian hiển thị tối đa (max_duration = 5.0s)
        - Tránh đè mốc thời gian giữa 2 phụ đề liên tiếp
        - Áp dụng ngắt dòng tự động
        """
        if not segments:
            return []

        optimized = []
        num_segs = len(segments)

        for idx, seg in enumerate(segments):
            start = seg.start
            end = seg.end
            duration = end - start

            # 1. Đảm bảo thời gian tối thiểu
            if duration < self.style.min_duration:
                end = start + self.style.min_duration

            # 2. Đảm bảo không đè lên mốc start của segment kế tiếp
            if idx < num_segs - 1:
                next_start = segments[idx + 1].start
                if end > next_start:
                    end = max(start + 0.3, next_start - 0.05)

            # 3. Đảm bảo thời gian tối đa
            if end - start > self.style.max_duration:
                end = start + self.style.max_duration

            # 4. Ngắt dòng văn bản (tiếng Việt hoặc tiếng Trung)
            source_text = self.wrap_text(seg.text, max_chars=self.style.max_chars_per_line, max_lines=self.style.max_lines)
            translated_text = None
            if seg.translated_text:
                translated_text = self.wrap_text(seg.translated_text, max_chars=self.style.max_chars_per_line, max_lines=self.style.max_lines)

            optimized_seg = SubtitleSegment(
                start=round(start, 2),
                end=round(end, 2),
                text=source_text,
                translated_text=translated_text,
                speaker=seg.speaker,
                confidence=seg.confidence
            )
            optimized.append(optimized_seg)

        return optimized

    def generate_ass_file(
        self,
        segments: List[SubtitleSegment],
        output_ass_path: str,
        video_width: int = 1080,
        video_height: int = 1920
    ) -> str:
        """Tạo và ghi file .ass ra ổ đĩa."""
        os.makedirs(os.path.dirname(os.path.abspath(output_ass_path)), exist_ok=True)

        style = resolve_style_for_resolution(self.style, video_width, video_height)
        optimized_segs = self.optimize_segments(segments)
        builder = ASSBuilder(style=style, play_res_x=video_width, play_res_y=video_height)
        ass_content = builder.build(optimized_segs)

        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(ass_content)

        logger.info(f"Generated ASS subtitle file: {output_ass_path}")
        return output_ass_path
