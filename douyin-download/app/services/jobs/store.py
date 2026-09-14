import json
import time
import uuid
from typing import Any, Dict, List, Optional, Protocol

from app.core.config import get_settings
from app.schemas.job import JobKind, JobStatus, TERMINAL_STATUSES


def new_job_id() -> str:
    return uuid.uuid4().hex


def now() -> float:
    return time.time()


def empty_job(**fields: Any) -> Dict[str, Any]:
    ts = now()
    job = {
        "job_id": new_job_id(),
        "kind": JobKind.VIDEO.value,
        "status": JobStatus.QUEUED.value,
        "progress": 0,
        "message": "Queued",
        "error_code": None,
        "url": None,
        "urls": [],
        "play_url": None,
        "title": None,
        "aweme_id": None,
        "insert_subtitle": False,
        "remove_original_subtitle": False,
        "source_language": "zh",
        "target_language": "vi",
        "cookie": None,
        "limit": 0,
        "parent_id": None,
        "children": [],
        "output_path": None,
        "subtitle_path": None,
        "cancelled": False,
        "created_at": ts,
        "updated_at": ts,
    }
    job.update(fields)
    return job


class JobStore(Protocol):
    def create(self, **fields: Any) -> Dict[str, Any]:
        ...

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        ...

    def update(self, job_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
        ...

    def delete(self, job_id: str) -> bool:
        ...

    def is_cancelled(self, job_id: str) -> bool:
        ...


class MemoryJobStore:
    """In-process store for tests. Not shared across API/worker processes."""

    def __init__(self) -> None:
        self._data: Dict[str, Dict[str, Any]] = {}

    def create(self, **fields: Any) -> Dict[str, Any]:
        job = empty_job(**fields)
        self._data[job["job_id"]] = job
        return dict(job)

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self._data.get(job_id)
        return dict(job) if job else None

    def update(self, job_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
        job = self._data.get(job_id)
        if not job:
            return None
        job.update(fields)
        job["updated_at"] = now()
        return dict(job)

    def delete(self, job_id: str) -> bool:
        return self._data.pop(job_id, None) is not None

    def is_cancelled(self, job_id: str) -> bool:
        job = self._data.get(job_id)
        return bool(job and job.get("cancelled"))


class RedisJobStore:
    def __init__(self, redis_url: str, ttl_seconds: int) -> None:
        import redis

        self._redis = redis.from_url(redis_url, decode_responses=True)
        self._ttl = ttl_seconds

    def _key(self, job_id: str) -> str:
        return f"job:{job_id}"

    def create(self, **fields: Any) -> Dict[str, Any]:
        job = empty_job(**fields)
        self._save(job)
        return dict(job)

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        raw = self._redis.get(self._key(job_id))
        if not raw:
            return None
        return json.loads(raw)

    def update(self, job_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
        job = self.get(job_id)
        if not job:
            return None
        job.update(fields)
        job["updated_at"] = now()
        self._save(job)
        return job

    def delete(self, job_id: str) -> bool:
        return bool(self._redis.delete(self._key(job_id)))

    def is_cancelled(self, job_id: str) -> bool:
        job = self.get(job_id)
        return bool(job and job.get("cancelled"))

    def _save(self, job: Dict[str, Any]) -> None:
        self._redis.setex(self._key(job["job_id"]), self._ttl, json.dumps(job, ensure_ascii=False))


_store: Optional[JobStore] = None


def get_store() -> JobStore:
    global _store
    if _store is None:
        settings = get_settings()
        _store = RedisJobStore(settings.redis_url, settings.job_ttl_seconds)
    return _store


def set_store(store: JobStore) -> None:
    global _store
    _store = store


def public_job(job: Dict[str, Any], children: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    status = job.get("status")
    return {
        "job_id": job.get("job_id"),
        "kind": job.get("kind"),
        "status": status,
        "progress": int(job.get("progress") or 0),
        "message": job.get("message") or "",
        "error_code": job.get("error_code"),
        "title": job.get("title"),
        "aweme_id": job.get("aweme_id"),
        "insert_subtitle": bool(job.get("insert_subtitle")),
        "parent_id": job.get("parent_id"),
        "children": list(job.get("children") or []),
        "jobs": children or [],
        "download_ready": bool(job.get("output_path") and status == JobStatus.COMPLETED.value),
        "subtitle_ready": bool(job.get("subtitle_path") and status not in (JobStatus.FAILED.value,)),
        "created_at": job.get("created_at") or 0,
        "updated_at": job.get("updated_at") or 0,
    }


def is_terminal(status: str) -> bool:
    return status in TERMINAL_STATUSES
