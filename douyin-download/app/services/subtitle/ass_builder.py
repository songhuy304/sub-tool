import math
from typing import List
from app.schemas.subtitle import SubtitleSegment, SubtitleStyleConfig


class ASSBuilder:
    """Tạo nội dung file phụ đề chuẩn ASS (Advanced SubStation Alpha)."""

    def __init__(self, style: SubtitleStyleConfig, play_res_x: int = 1080, play_res_y: int = 1920):
        self.style = style
        self.play_res_x = play_res_x if play_res_x > 0 else 1080
        self.play_res_y = play_res_y if play_res_y > 0 else 1920

    @staticmethod
    def format_timestamp(seconds: float) -> str:
        """Định dạng số giây sang ASS Timestamp format H:MM:SS.cs (VD: 0:01:23.45)."""
        if seconds < 0:
            seconds = 0
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centisecs = int(math.floor((seconds % 1) * 100))

        return f"{hrs}:{mins:02d}:{secs:02d}.{centisecs:02d}"

    def build(self, segments: List[SubtitleSegment]) -> str:
        """Tạo toàn bộ chuỗi văn bản định dạng ASS."""
        bold_val = -1 if self.style.bold else 0
        italic_val = -1 if self.style.italic else 0

        header = f"""[Script Info]
Title: Douyin Video Subtitle
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: {self.play_res_x}
PlayResY: {self.play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{self.style.font_name},{self.style.font_size},{self.style.primary_color},&H000000FF,{self.style.outline_color},{self.style.back_color},{bold_val},{italic_val},0,0,100,100,0,0,1,{self.style.outline_width},{self.style.shadow_width},{self.style.alignment},{self.style.margin_l},{self.style.margin_r},{self.style.margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        dialogue_lines = []
        for seg in segments:
            text_to_show = seg.translated_text if seg.translated_text else seg.text
            if not text_to_show or not text_to_show.strip():
                continue

            start_str = self.format_timestamp(seg.start)
            end_str = self.format_timestamp(seg.end)

            formatted_text = (
                text_to_show.replace("\\", "\\\\")
                .replace("{", "\\{")
                .replace("}", "\\}")
                .replace("\n", "\\N")
            )

            dialogue = f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{formatted_text}"
            dialogue_lines.append(dialogue)

        return header + "\n".join(dialogue_lines) + "\n"
