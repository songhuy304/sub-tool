import logging
import shutil
from pathlib import Path
from typing import Callable, Optional

from app.core.config import Settings, get_settings
from app.schemas.job import JobKind, JobStatus
from app.schemas.subtitle import SubtitleProcessRequest
from app.services.downloader.douyin import (
    DouyinCookieError,
    DouyinDownloader,
    UnsupportedDouyinLink,
    VideoItem,
    iter_unique_items,
)
from app.services.jobs.store import JobStore, get_store
from app.services.pipeline.subtitle_pipeline import SubtitlePipeline
from app.services.speech.whisper import FasterWhisperRecognizer
from app.utils.files import job_paths

logger = logging.getLogger(__name__)

ProgressFn = Callable[[str, int, str], None]
EnqueueFn = Callable[[str], None]


class JobCancelled(Exception):
    pass


class JobProcessor:
    def __init__(
        self,
        store: Optional[JobStore] = None,
        settings: Optional[Settings] = None,
        enqueue_child: Optional[EnqueueFn] = None,
        recognizer: Optional[FasterWhisperRecognizer] = None,
        downloader_factory: Optional[Callable[[Optional[str]], DouyinDownloader]] = None,
    ):
        self.store = store or get_store()
        self.settings = settings or get_settings()
        self.enqueue_child = enqueue_child
        self.recognizer = recognizer
        self.downloader_factory = downloader_factory or (lambda cookie: DouyinDownloader(cookie=cookie))

    def run(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if not job:
            logger.error("[%s] Job not found", job_id)
            return
        if job.get("cancelled"):
            self.store.update(job_id, status=JobStatus.CANCELLED.value, message="Cancelled", progress=0)
            return

        try:
            if job.get("kind") == JobKind.BATCH.value or job.get("urls"):
                self._run_batch(job)
            else:
                self._run_video(job)
        except JobCancelled:
            self.store.update(job_id, status=JobStatus.CANCELLED.value, progress=0, message="Cancelled")
        except UnsupportedDouyinLink:
            self._fail(job_id, "UNSUPPORTED_LINK", _error_message("UNSUPPORTED_LINK"))
        except DouyinCookieError as exc:
            code = _error_code(exc)
            self._fail(job_id, code, _error_message(code))
        except Exception as exc:
            logger.exception("[%s] Job failed: %s", job_id, exc)
            code = _error_code(exc)
            self._fail(job_id, code, _error_message(code))

    def _run_batch(self, job: dict) -> None:
        job_id = job["job_id"]
        self._guard(job_id)
        self._progress(job_id, JobStatus.RESOLVING.value, 5, "Đang phân giải link")
        urls = list(job.get("urls") or [])
        if job.get("url"):
            urls.insert(0, job["url"])
        urls = [item for item in urls if item]
        if not urls:
            raise UnsupportedDouyinLink("INVALID_URL")

        downloader = self.downloader_factory(job.get("cookie") or self.settings.douyin_cookie)
        limit = int(job.get("limit") or 0) or self.settings.default_user_limit
        groups = [downloader.expand(url, limit=limit) for url in urls]
        items = iter_unique_items(groups)
        if not items:
            raise RuntimeError("NO_VIDEO")

        if len(items) == 1 and not job.get("urls"):
            self.store.update(job_id, kind=JobKind.VIDEO.value, url=urls[0])
            job = self.store.get(job_id) or job
            self._process_item(job, items[0], downloader)
            return

        self._fanout(job, items)

    def _run_video(self, job: dict) -> None:
        job_id = job["job_id"]
        downloader = self.downloader_factory(job.get("cookie") or self.settings.douyin_cookie)
        if job.get("play_url"):
            item = VideoItem(
                aweme_id=str(job.get("aweme_id") or ""),
                title=job.get("title") or job_id,
                play_url=job["play_url"],
            )
            self._process_item(job, item, downloader)
            return

        self._progress(job_id, JobStatus.RESOLVING.value, 5, "Đang phân giải link")
        url = job.get("url")
        if not url:
            raise UnsupportedDouyinLink("INVALID_URL")
        items = downloader.expand(url, limit=int(job.get("limit") or 0) or self.settings.default_user_limit)
        if not items:
            raise RuntimeError("NO_VIDEO")
        if len(items) > 1:
            self._fanout(job, items)
            return
        self._process_item(job, items[0], downloader)

    def _fanout(self, job: dict, items: list) -> None:
        job_id = job["job_id"]
        children = []
        for item in items:
            child = self.store.create(
                kind=JobKind.VIDEO.value,
                parent_id=job_id,
                play_url=item.play_url,
                title=item.title,
                aweme_id=item.aweme_id,
                insert_subtitle=job.get("insert_subtitle"),
                remove_original_subtitle=job.get("remove_original_subtitle"),
                source_language=job.get("source_language"),
                target_language=job.get("target_language"),
                cookie=job.get("cookie"),
            )
            children.append(child["job_id"])

        self.store.update(
            job_id,
            kind=JobKind.BATCH.value,
            children=children,
            status=JobStatus.DOWNLOADING.value,
            progress=10,
            message=f"Đã tạo {len(children)} job",
        )
        for child_id in children:
            if self.enqueue_child:
                self.enqueue_child(child_id)
            else:
                self.run(child_id)
        self._refresh_parent(job_id)

    def _process_item(self, job: dict, item: VideoItem, downloader: DouyinDownloader) -> None:
        job_id = job["job_id"]
        self._guard(job_id)
        paths = job_paths(self.settings, job_id)
        self.store.update(
            job_id,
            title=item.title,
            aweme_id=item.aweme_id or job.get("aweme_id"),
            play_url=item.play_url,
        )
        self._progress(job_id, JobStatus.DOWNLOADING.value, 15, "Đang tải video")

        def on_dl(received: int, total: int) -> None:
            self._guard(job_id)
            if total > 0:
                pct = 15 + int(received / total * (25 if job.get("insert_subtitle") else 80))
                self._progress(job_id, JobStatus.DOWNLOADING.value, min(pct, 94), "Đang tải video")

        source = Path(job.get("input_path") or "")
        if source.is_file():
            shutil.copy2(source, paths.input_path)
        else:
            downloader.download(item.play_url, paths.input_path, on_progress=on_dl)

        max_bytes = self.settings.max_video_size_mb * 1024 * 1024
        if paths.input_path.stat().st_size > max_bytes:
            raise RuntimeError("VIDEO_TOO_LARGE")

        if not job.get("insert_subtitle"):
            shutil.copy2(paths.input_path, paths.output_path)
            self.store.update(
                job_id,
                status=JobStatus.COMPLETED.value,
                progress=100,
                message="Hoàn tất",
                output_path=str(paths.output_path),
            )
            shutil.rmtree(paths.temp_dir, ignore_errors=True)
            self._touch_parent(job.get("parent_id"))
            return

        def on_sub(status: str, progress: int, message: str) -> None:
            self._guard(job_id)
            self._progress(job_id, status, progress, message)

        pipeline = SubtitlePipeline(speech_recognizer=self.recognizer)
        result = pipeline.run(
            SubtitleProcessRequest(
                video_path=str(paths.input_path),
                output_path=str(paths.output_path),
                source_lang=job.get("source_language") or self.settings.source_language,
                target_lang=job.get("target_language") or self.settings.target_language,
                whisper_model=self.settings.whisper_model,
                device=self.settings.whisper_device,
                remove_original_subtitle=bool(job.get("remove_original_subtitle")),
            ),
            cleanup_temp=True,
            on_progress=on_sub,
        )
        if not result.success:
            raise RuntimeError(result.error_message or "RENDER_FAILED")

        subtitle_path = None
        if result.subtitle_ass_path and Path(result.subtitle_ass_path).exists():
            shutil.copy2(result.subtitle_ass_path, paths.subtitle_path)
            subtitle_path = str(paths.subtitle_path)

        self.store.update(
            job_id,
            status=JobStatus.COMPLETED.value,
            progress=100,
            message="Hoàn tất",
            output_path=str(paths.output_path),
            subtitle_path=subtitle_path,
        )
        shutil.rmtree(paths.temp_dir, ignore_errors=True)
        self._touch_parent(job.get("parent_id"))

    def _refresh_parent(self, parent_id: Optional[str]) -> None:
        if not parent_id:
            return
        parent = self.store.get(parent_id)
        if not parent:
            return
        children = [self.store.get(cid) for cid in parent.get("children") or []]
        children = [item for item in children if item]
        if not children:
            return
        progress = int(sum(int(item.get("progress") or 0) for item in children) / len(children))
        done = sum(1 for item in children if item.get("status") == JobStatus.COMPLETED.value)
        failed = sum(1 for item in children if item.get("status") == JobStatus.FAILED.value)
        cancelled = sum(1 for item in children if item.get("status") == JobStatus.CANCELLED.value)
        finished = done + failed + cancelled
        if finished == len(children):
            status = JobStatus.COMPLETED.value if done else JobStatus.FAILED.value
            if cancelled == len(children):
                status = JobStatus.CANCELLED.value
            message = f"Xong {done}/{len(children)}"
        else:
            status = JobStatus.DOWNLOADING.value
            message = f"Đang xử lý {finished}/{len(children)}"
        self.store.update(parent_id, status=status, progress=progress, message=message)

    def _touch_parent(self, parent_id: Optional[str]) -> None:
        self._refresh_parent(parent_id)

    def _progress(self, job_id: str, status: str, progress: int, message: str) -> None:
        self.store.update(job_id, status=status, progress=max(0, min(100, progress)), message=message)
        job = self.store.get(job_id) or {}
        self._refresh_parent(job.get("parent_id"))

    def _fail(self, job_id: str, error_code: str, message: str) -> None:
        self.store.update(
            job_id,
            status=JobStatus.FAILED.value,
            error_code=error_code,
            message=message,
        )
        job = self.store.get(job_id) or {}
        self._touch_parent(job.get("parent_id"))

    def _guard(self, job_id: str) -> None:
        if self.store.is_cancelled(job_id):
            raise JobCancelled()


def _error_code(exc: Exception) -> str:
    text = str(exc)
    for code in (
        "COOKIE_REQUIRED",
        "COOKIE_INVALID",
        "INVALID_URL",
        "UNSUPPORTED_LINK",
        "DOWNLOAD_FAILED",
        "NO_VIDEO",
        "VIDEO_TOO_LARGE",
        "TRANSCRIPTION_FAILED",
        "RENDER_FAILED",
    ):
        if code in text:
            return code
    return "PROCESSING_FAILED"


def _error_message(code: str) -> str:
    return {
        "COOKIE_REQUIRED": (
            "Douyin chặn request vì thiếu cookie. "
            "Hãy đăng nhập douyin.com → F12 → Application → Cookies → copy Cookie "
            "(sessionid, ttwid, msToken) rồi dán vào ô Cookie và Retry."
        ),
        "COOKIE_INVALID": (
            "Cookie Douyin không hợp lệ hoặc đã hết hạn. "
            "Lấy cookie mới từ trình duyệt (đã đăng nhập) rồi dán lại và Retry."
        ),
        "UNSUPPORTED_LINK": "Link Douyin không hỗ trợ",
        "INVALID_URL": "URL không hợp lệ",
        "NO_VIDEO": "Không tìm thấy video từ link này",
        "DOWNLOAD_FAILED": "Tải file video thất bại",
        "VIDEO_TOO_LARGE": "Video vượt quá dung lượng cho phép",
        "TRANSCRIPTION_FAILED": "Nhận diện giọng nói thất bại",
        "RENDER_FAILED": "Ghép phụ đề thất bại",
    }.get(code, "Xử lý video thất bại")
