import shutil
import tempfile
import unittest
from pathlib import Path

from app.core.config import Settings
from app.schemas.job import JobKind, JobStatus
from app.services.downloader.douyin import VideoItem
from app.services.jobs.store import MemoryJobStore
from app.services.pipeline.processor import JobProcessor


class DummyDownloader:
    def __init__(self, items):
        self.items = items
        self.downloaded = []

    def expand(self, url, limit=0):
        return list(self.items)

    def download(self, play_url, dest, on_progress=None):
        dest.write_bytes(b"fake-mp4-bytes")
        if on_progress:
            on_progress(14, 14)
        self.downloaded.append(play_url)
        return dest


class TestJobProcessor(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="jobproc_"))
        self.settings = Settings(storage_path=str(self.tmp), redis_url="redis://localhost:6379/0")
        self.settings.ensure_storage()
        self.store = MemoryJobStore()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_download_only_skips_subtitle(self):
        item = VideoItem(aweme_id="1", title="hello", play_url="https://cdn/a.mp4")
        downloader = DummyDownloader([item])
        processor = JobProcessor(
            store=self.store,
            settings=self.settings,
            downloader_factory=lambda cookie: downloader,
        )
        job = self.store.create(url="https://www.douyin.com/video/1", insert_subtitle=False)
        processor.run(job["job_id"])
        done = self.store.get(job["job_id"])
        self.assertEqual(done["status"], JobStatus.COMPLETED.value)
        self.assertEqual(done["progress"], 100)
        self.assertTrue(Path(done["output_path"]).exists())
        self.assertIsNone(done.get("subtitle_path"))
        self.assertEqual(downloader.downloaded, ["https://cdn/a.mp4"])

    def test_cookie_required_error_message(self):
        from app.services.pipeline.processor import _error_message

        msg = _error_message("COOKIE_REQUIRED")
        self.assertIn("cookie", msg.lower())
        self.assertIn("Douyin", msg)

    def test_cookie_invalid_error_message(self):
        from app.services.pipeline.processor import _error_code, _error_message
        from app.services.downloader.douyin import DouyinCookieError

        code = _error_code(DouyinCookieError("COOKIE_INVALID"))
        self.assertEqual(code, "COOKIE_INVALID")
        self.assertIn("hết hạn", _error_message(code))

    def test_batch_fanout_creates_child_jobs(self):
        items = [
            VideoItem(aweme_id="1", title="a", play_url="https://cdn/a.mp4"),
            VideoItem(aweme_id="2", title="b", play_url="https://cdn/b.mp4"),
        ]
        downloader = DummyDownloader(items)
        processor = JobProcessor(
            store=self.store,
            settings=self.settings,
            downloader_factory=lambda cookie: downloader,
        )
        job = self.store.create(
            kind=JobKind.VIDEO.value,
            url="https://www.douyin.com/user/sec",
            insert_subtitle=False,
        )
        processor.run(job["job_id"])
        parent = self.store.get(job["job_id"])
        self.assertEqual(parent["kind"], JobKind.BATCH.value)
        self.assertEqual(len(parent["children"]), 2)
        self.assertEqual(parent["status"], JobStatus.COMPLETED.value)
        for child_id in parent["children"]:
            child = self.store.get(child_id)
            self.assertEqual(child["status"], JobStatus.COMPLETED.value)
            self.assertTrue(Path(child["output_path"]).exists())


if __name__ == "__main__":
    unittest.main()
