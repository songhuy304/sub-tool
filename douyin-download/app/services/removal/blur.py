"""Làm mờ dải phụ đề burned-in ở đáy video (kiểu Douyin)."""

from typing import Tuple


class BlurSubtitleRemover:
    """Tạo FFmpeg filtergraph làm mờ vùng phụ đề gốc rồi gắn file ASS."""

    def __init__(
        self,
        band_top_ratio: float = 0.80,
        band_bottom_ratio: float = 0.96,
        blur_power: int = 6,
    ):
        self.band_top_ratio = band_top_ratio
        self.band_bottom_ratio = band_bottom_ratio
        self.blur_power = blur_power

    @staticmethod
    def _even(value: int) -> int:
        return value if value % 2 == 0 else value - 1

    def compute_band(self, width: int, height: int) -> Tuple[int, int, int, int]:
        """Trả về (x, y, w, h) của dải phụ đề, các cạnh chẵn cho yuv420."""
        w = self._even(max(2, width))
        h = max(2, height)
        y = self._even(max(0, int(h * self.band_top_ratio)))
        bottom = self._even(min(h, int(h * self.band_bottom_ratio)))
        band_h = self._even(max(32, bottom - y))
        if y + band_h > h:
            y = self._even(max(0, h - band_h))
        return 0, y, w, band_h

    def build_filter_complex(self, width: int, height: int, ass_filename: str = "sub.ass") -> str:
        """Filtergraph: crop đáy → boxblur → overlay → ass."""
        _x, y, _w, band_h = self.compute_band(width, height)
        radius = max(8, min(24, band_h // 8))
        return (
            f"[0:v]split[base][forblur];"
            f"[forblur]crop=iw:{band_h}:0:{y},boxblur={radius}:{self.blur_power}[blurred];"
            f"[base][blurred]overlay=0:{y}[vblur];"
            f"[vblur]ass={ass_filename}[vout]"
        )
