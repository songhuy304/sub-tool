import logging
import os

logger = logging.getLogger(__name__)


def enqueue_job(job_id: str) -> None:
    """Đẩy job vào worker. Fallback chạy sync khi bật CELERY_TASK_ALWAYS_EAGER."""
    if os.getenv("CELERY_TASK_ALWAYS_EAGER", "").lower() in {"1", "true", "yes"}:
        from app.services.pipeline.processor import JobProcessor

        JobProcessor().run(job_id)
        return
    try:
        from app.workers.tasks import process_job

        process_job.delay(job_id)
    except Exception as exc:
        logger.error("Cannot enqueue job %s: %s", job_id, exc)
        raise
