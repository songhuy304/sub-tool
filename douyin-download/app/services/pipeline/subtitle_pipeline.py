import os
import shutil
import tempfile
import logging
from typing import Callable, Optional
from app.schemas.subtitle import (
    SubtitleProcessRequest,
    PipelineResult,
)
from app.services.video.ffmpeg import FFmpegService
from app.services.speech.whisper import FasterWhisperRecognizer
from app.services.translation.openai_translator import OpenAITranslator
from app.services.translation.google_translator import GoogleTranslator
from app.services.subtitle.generator import SubtitleGenerator
from app.services.translation.utils import majority_untranslated

logger = logging.getLogger(__name__)

ProgressCb = Optional[Callable[[str, int, str], None]]


class SubtitlePipeline:
    """Pipeline chính điều phối toàn bộ quy trình tự động làm phụ đề cho video."""

    def __init__(
        self,
        ffmpeg_service: Optional[FFmpegService] = None,
        speech_recognizer: Optional[FasterWhisperRecognizer] = None,
        translation_provider: Optional[OpenAITranslator] = None,
    ):
        self.ffmpeg_service = ffmpeg_service or FFmpegService()
        self.speech_recognizer = speech_recognizer
        self.translation_provider = translation_provider

    def run(
        self,
        request: SubtitleProcessRequest,
        cleanup_temp: bool = True,
        on_progress: ProgressCb = None,
    ) -> PipelineResult:
        video_path = os.path.abspath(request.video_path)
        if not os.path.exists(video_path):
            return PipelineResult(
                success=False,
                output_video_path="",
                subtitle_ass_path="",
                transcription=None,
                translation=None,
                error_message=f"Video file not found: {video_path}"
            )

        # Xác định đường dẫn đầu ra mặc định nếu không truyền
        if request.output_path:
            output_video_path = os.path.abspath(request.output_path)
        else:
            base, ext = os.path.splitext(video_path)
            output_video_path = f"{base}_subbed{ext}"

        temp_dir = tempfile.mkdtemp(prefix="subtitle_pipeline_")
        subtitle_ass_path = os.path.join(temp_dir, "subtitle.ass")
        extracted_wav_path = os.path.join(temp_dir, "audio.wav")

        def report(status: str, progress: int, message: str) -> None:
            if on_progress:
                on_progress(status, progress, message)

        try:
            logger.info(f"[Step 1/6] Probing video info: {video_path}")
            report("extracting_audio", 42, "Đang đọc thông tin video")
            video_info = self.ffmpeg_service.probe(video_path)
            w = video_info.get("width", 1080)
            h = video_info.get("height", 1920)

            logger.info("[Step 2/6] Extracting audio to WAV...")
            report("extracting_audio", 48, "Đang tách audio")
            self.ffmpeg_service.extract_audio(video_path, extracted_wav_path)

            logger.info(f"[Step 3/6] Transcribing audio with Whisper ({request.whisper_model})...")
            report("transcribing", 55, "Đang nhận diện giọng nói")
            recognizer = self.speech_recognizer or FasterWhisperRecognizer(
                model_size=request.whisper_model,
                device=request.device
            )
            transcription = recognizer.transcribe(extracted_wav_path, language=request.source_lang)
            if not transcription.segments:
                logger.warning("Whisper không nhận được đoạn thoại nào từ audio.")
                shutil.copy2(video_path, output_video_path)
                report("completed", 100, "Không có lời thoại, giữ video gốc")
                return PipelineResult(
                    success=True,
                    output_video_path=output_video_path,
                    subtitle_ass_path="",
                    transcription=transcription,
                    translation=None,
                )

            logger.info(f"[Step 4/6] Translating segments ({request.source_lang} -> {request.target_lang})...")
            report("translating", 72, "Đang dịch phụ đề Việt")
            translator = self.translation_provider or OpenAITranslator()
            translation = translator.translate_segments(
                transcription.segments,
                source_lang=request.source_lang,
                target_lang=request.target_lang
            )
            if self.translation_provider is None and majority_untranslated(translation.segments):
                logger.warning("Bản dịch vẫn giống tiếng Trung. Thử lại bằng GoogleTranslator...")
                translation = GoogleTranslator().translate_segments(
                    transcription.segments,
                    source_lang=request.source_lang,
                    target_lang=request.target_lang
                )

            logger.info("[Step 5/6] Generating ASS subtitle file...")
            report("generating_subtitle", 82, "Đang tạo file phụ đề")
            generator = SubtitleGenerator(style=request.style)
            generated_ass = generator.generate_ass_file(
                segments=translation.segments,
                output_ass_path=subtitle_ass_path,
                video_width=w,
                video_height=h
            )

            logger.info("[Step 6/6] Burning subtitle onto output video...")
            report("rendering", 90, "Đang chèn phụ đề vào video")
            self.ffmpeg_service.burn_subtitle(
                video_path=video_path,
                subtitle_ass_path=generated_ass,
                output_video_path=output_video_path,
                blur_original=request.remove_original_subtitle,
                video_width=w,
                video_height=h,
            )

            # Lưu lại file ass bản sao cạnh video đầu ra để tiện dùng lại
            output_ass_final = os.path.splitext(output_video_path)[0] + ".ass"
            shutil.copy(generated_ass, output_ass_final)

            logger.info(f"Pipeline finished successfully! Output video: {output_video_path}")
            return PipelineResult(
                success=True,
                output_video_path=output_video_path,
                subtitle_ass_path=output_ass_final,
                transcription=transcription,
                translation=translation
            )

        except Exception as e:
            logger.exception(f"Pipeline execution failed: {e}")
            return PipelineResult(
                success=False,
                output_video_path="",
                subtitle_ass_path="",
                transcription=None,
                translation=None,
                error_message=str(e)
            )
        finally:
            if cleanup_temp and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
