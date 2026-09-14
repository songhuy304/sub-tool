import unittest
import os
import tempfile
from app.schemas.subtitle import (
    SubtitleSegment,
    SubtitleStyleConfig,
    SubtitleProcessRequest
)
from app.services.subtitle.ass_builder import ASSBuilder
from app.services.subtitle.generator import SubtitleGenerator, resolve_style_for_resolution
from app.services.translation.local_translator import LocalFallbackTranslator
from app.services.speech.whisper import FasterWhisperRecognizer
from app.services.pipeline.subtitle_pipeline import SubtitlePipeline
from app.services.video.ffmpeg import FFmpegService
from app.services.removal.blur import BlurSubtitleRemover
from app.services.translation.utils import looks_untranslated, majority_untranslated
from app.services.translation.google_translator import GoogleTranslator


class DummyFFmpegService(FFmpegService):
    """FFmpegService giả lập để chạy unit test pipeline không cần file video thật."""
    def probe(self, video_path: str):
        return {"duration": 10.0, "width": 1080, "height": 1920, "fps": 30.0, "has_video": True, "has_audio": True}

    def extract_audio(self, video_path: str, output_wav_path: str, sample_rate: int = 16000, channels: int = 1):
        with open(output_wav_path, "wb") as f:
            f.write(b"RIFFdummyWAVdata")
        return output_wav_path

    def burn_subtitle(self, video_path: str, subtitle_ass_path: str, output_video_path: str, **kwargs):
        with open(output_video_path, "wb") as f:
            f.write(b"dummy_subbed_video")
        return output_video_path


class TestSubtitleTool(unittest.TestCase):

    def test_ass_builder_timestamp(self):
        """Kiểm tra định dạng timestamp trong ASSBuilder."""
        ts = ASSBuilder.format_timestamp(65.456)
        self.assertEqual(ts, "0:01:05.45")

    def test_ass_builder_output(self):
        """Kiểm tra cấu trúc file ASS tạo ra từ ASSBuilder."""
        style = SubtitleStyleConfig(font_name="Roboto", font_size=24)
        builder = ASSBuilder(style=style, play_res_x=1080, play_res_y=1920)
        segments = [
            SubtitleSegment(start=1.0, end=3.5, text="你好", translated_text="Xin chào")
        ]
        content = builder.build(segments)

        self.assertIn("[Script Info]", content)
        self.assertIn("PlayResX: 1080", content)
        self.assertIn("Style: Default,Roboto,24", content)
        self.assertIn("Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Xin chào", content)

    def test_subtitle_generator_wrap_text(self):
        """Kiểm tra chức năng ngắt dòng tự động của SubtitleGenerator."""
        generator = SubtitleGenerator()
        long_text = "Đây là một câu phụ đề rất dài dùng để kiểm tra tính năng tự động ngắt dòng thông minh"
        wrapped = generator.wrap_text(long_text, max_chars=30, max_lines=2)

        self.assertIn("\n", wrapped)
        self.assertLessEqual(len(wrapped.split("\n")), 2)

    def test_subtitle_generator_timing_optimization(self):
        """Kiểm tra việc tối ưu mốc thời gian hiển thị tối thiểu và tối đa."""
        style = SubtitleStyleConfig(min_duration=1.0, max_duration=4.0)
        generator = SubtitleGenerator(style=style)

        # Segment ngắn 0.3s -> kéo dài lên min 1.0s
        segments = [
            SubtitleSegment(start=1.0, end=1.3, text="Short")
        ]
        optimized = generator.optimize_segments(segments)
        self.assertEqual(optimized[0].end, 2.0)  # 1.0 + min_duration (1.0)

    def test_local_fallback_translator(self):
        """Kiểm tra bộ dịch offline LocalFallbackTranslator."""
        translator = LocalFallbackTranslator()
        segs = [
            SubtitleSegment(start=0.0, end=2.0, text="大家好")
        ]
        result = translator.translate_segments(segs, source_lang="zh", target_lang="vi")

        self.assertEqual(len(result.segments), 1)
        self.assertEqual(result.segments[0].translated_text, "Xin chào mọi người")

    def test_faster_whisper_fallback(self):
        """Kiểm tra FasterWhisperRecognizer ở chế độ fallback."""
        recognizer = FasterWhisperRecognizer(model_size="small", device="cpu", allow_mock=True)

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(b"fake wav data")
            tmp_path = tmp.name

        try:
            res = recognizer.transcribe(tmp_path, language="zh")
            self.assertIsNotNone(res.segments)
            self.assertGreater(len(res.segments), 0)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_subtitle_pipeline(self):
        """Kiểm tra chạy toàn bộ SubtitlePipeline với mock services."""
        dummy_ffmpeg = DummyFFmpegService()
        pipeline = SubtitlePipeline(
            ffmpeg_service=dummy_ffmpeg,
            speech_recognizer=FasterWhisperRecognizer(allow_mock=True),
            translation_provider=LocalFallbackTranslator()
        )

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(b"dummy video data")
            tmp_video = tmp.name

        try:
            req = SubtitleProcessRequest(
                video_path=tmp_video,
                source_lang="zh",
                target_lang="vi"
            )
            res = pipeline.run(req)

            self.assertTrue(res.success)
            self.assertTrue(os.path.exists(res.output_video_path))
            self.assertTrue(os.path.exists(res.subtitle_ass_path))
            self.assertIsNotNone(res.transcription)
            self.assertIsNotNone(res.translation)
        finally:
            if os.path.exists(tmp_video):
                os.remove(tmp_video)
            if res.success:
                if os.path.exists(res.output_video_path):
                    os.remove(res.output_video_path)
                if os.path.exists(res.subtitle_ass_path):
                    os.remove(res.subtitle_ass_path)

    def test_resolve_style_scales_for_1440p(self):
        style = SubtitleStyleConfig()
        resolved = resolve_style_for_resolution(style, 1080, 1440)
        self.assertGreaterEqual(resolved.font_size, 56)
        self.assertGreaterEqual(resolved.margin_v, 80)
        self.assertGreaterEqual(resolved.outline_width, 3.0)

    def test_blur_band_is_even(self):
        remover = BlurSubtitleRemover()
        x, y, w, h = remover.compute_band(1080, 1440)
        self.assertEqual(x, 0)
        self.assertEqual(w % 2, 0)
        self.assertEqual(y % 2, 0)
        self.assertEqual(h % 2, 0)
        self.assertGreater(h, 30)
        self.assertLess(y + h, 1441)
        graph = remover.build_filter_complex(1080, 1440, "sub.ass")
        self.assertIn("boxblur", graph)
        self.assertIn("ass=sub.ass", graph)

    def test_looks_untranslated(self):
        self.assertTrue(looks_untranslated("原来他们还在排队"))
        self.assertTrue(looks_untranslated("[Dịch-vi]: 你好"))
        self.assertFalse(looks_untranslated("Họ vẫn xếp hàng mua bánh"))

    def test_majority_untranslated(self):
        segs = [
            SubtitleSegment(start=0, end=1, text="你好", translated_text="你好"),
            SubtitleSegment(start=1, end=2, text="再见", translated_text="Tạm biệt"),
        ]
        self.assertTrue(majority_untranslated(segs, threshold=0.5))

    def test_google_translator_mock(self):
        class DummyResp:
            def raise_for_status(self):
                return None

            def json(self):
                return [[["Xin chào", "你好", None, None, 0]]]

        class DummyRequests:
            def get(self, *args, **kwargs):
                return DummyResp()

        translator = GoogleTranslator()
        segs = [SubtitleSegment(start=0, end=1, text="你好")]
        # inject fake requests via _translate_many
        lines = translator._translate_many(DummyRequests(), ["你好"], "zh-CN", "vi")
        self.assertEqual(lines[0], "Xin chào")

    def test_generate_ass_auto_font_for_video(self):
        generator = SubtitleGenerator(style=SubtitleStyleConfig())
        with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as tmp:
            ass_path = tmp.name
        try:
            generator.generate_ass_file(
                [SubtitleSegment(start=1, end=3, text="你好", translated_text="Xin chào")],
                ass_path,
                video_width=1080,
                video_height=1440,
            )
            with open(ass_path, encoding="utf-8") as f:
                content = f.read()
            self.assertIn("PlayResY: 1440", content)
            self.assertIn("Xin chào", content)
            self.assertNotIn("Style: Default,Arial,20,", content)
            self.assertRegex(content, r"Style: Default,Arial,(6[0-9]|7[0-9]),")
        finally:
            if os.path.exists(ass_path):
                os.remove(ass_path)


if __name__ == "__main__":
    unittest.main()
