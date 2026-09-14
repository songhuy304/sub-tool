import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.jobs.store import MemoryJobStore, set_store


class TestApi(unittest.TestCase):
    def setUp(self):
        self.store = MemoryJobStore()
        set_store(self.store)
        self.client = TestClient(app)

    def test_health(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_process_returns_job_id(self):
        with patch("app.api.routes.videos.enqueue_job") as enqueue:
            res = self.client.post(
                "/api/v1/videos/process",
                json={"url": "https://www.douyin.com/video/123", "insert_subtitle": True},
            )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["job_id"])
        self.assertEqual(body["status"], "queued")
        enqueue.assert_called_once_with(body["job_id"])
        job = self.store.get(body["job_id"])
        self.assertTrue(job["insert_subtitle"])
        self.assertTrue(job["remove_original_subtitle"])

    def test_batch_returns_batch_id(self):
        with patch("app.api.routes.videos.enqueue_job"):
            res = self.client.post(
                "/api/v1/videos/batch",
                json={"urls": ["https://www.douyin.com/video/1", "https://www.douyin.com/video/2"]},
            )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["batch_id"], body["job_id"])
        job = self.store.get(body["job_id"])
        self.assertEqual(job["kind"], "batch")
        self.assertEqual(len(job["urls"]), 2)

    def test_job_progress_endpoint(self):
        job = self.store.create(url="https://www.douyin.com/video/1")
        self.store.update(job["job_id"], status="downloading", progress=40, message="Đang tải video")
        res = self.client.get(f"/api/v1/jobs/{job['job_id']}")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["progress"], 40)
        self.assertEqual(body["status"], "downloading")
        self.assertFalse(body["download_ready"])


if __name__ == "__main__":
    unittest.main()
