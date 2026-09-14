import logging
import os
import threading

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.services.pipeline.processor import JobProcessor
from app.services.speech.whisper import FasterWhisperRecognizer
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)
setup_logging()

_recognizer = None
_recognizer_lock = threading.Lock()


def get_recognizer() -> FasterWhisperRecognizer:
    global _recognizer
    with _recognizer_lock:
        if _recognizer is None:
            settings = get_settings()
            _recognizer = FasterWhisperRecognizer(
                model_size=settings.whisper_model,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
                beam_size=settings.whisper_beam_size,
            )
        return _recognizer


def _enqueue(job_id: str) -> None:
    process_job.delay(job_id)


@celery_app.task(bind=True, name="app.workers.tasks.process_job")
def process_job(self, job_id: str) -> str:
    from app.services.jobs.store import get_store

    logger.info("[%s] Worker picked job", job_id)
    job = get_store().get(job_id) or {}
    recognizer = get_recognizer() if job.get("insert_subtitle") else None
    processor = JobProcessor(
        recognizer=recognizer,
        enqueue_child=_enqueue,
    )
    processor.run(job_id)
    return job_id


def eager_enabled() -> bool:
    return os.getenv("CELERY_TASK_ALWAYS_EAGER", "").lower() in {"1", "true", "yes"}
