import asyncio
import json
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Header, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.schemas.job import JobPublic, JobStatus
from app.services.jobs.store import get_store, is_terminal, public_job
from app.utils.files import public_filename
from app.workers.enqueue import enqueue_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


class RetryRequest(BaseModel):
    cookie: Optional[str] = Field(None, description="Cookie Douyin mới khi retry")


def _load(job_id: str) -> dict:
    job = get_store().get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _serialize(job: dict, include_children: bool = True) -> dict:
    children = []
    store = get_store()
    if include_children:
        for child_id in job.get("children") or []:
            child = store.get(child_id)
            if child:
                children.append(public_job(child))
    return public_job(job, children)


@router.get("/{job_id}", response_model=JobPublic, summary="Tiến trình job")
def get_job(job_id: str):
    return _serialize(_load(job_id))


@router.get("/{job_id}/events", summary="SSE tiến trình job")
async def job_events(job_id: str):
    _load(job_id)

    async def generate():
        last = None
        while True:
            job = get_store().get(job_id)
            if not job:
                yield f"event: error\ndata: {json.dumps({'error': 'not_found'})}\n\n"
                return
            payload = _serialize(job)
            snapshot = (payload["status"], payload["progress"], payload["message"])
            if snapshot != last:
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                last = snapshot
            if is_terminal(payload["status"]):
                return
            await asyncio.sleep(0.4)

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/{job_id}/download", summary="Tải video kết quả")
def download_job(job_id: str):
    job = _load(job_id)
    if job.get("status") != JobStatus.COMPLETED.value or not job.get("output_path"):
        raise HTTPException(status_code=409, detail="Job is not ready")
    path = Path(job["output_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Output file missing")
    filename = public_filename(job.get("title"), job_id, path.suffix or ".mp4")
    return FileResponse(path, media_type="video/mp4", filename=filename)


@router.get("/{job_id}/subtitle", summary="Tải file phụ đề ASS")
def download_subtitle(job_id: str):
    job = _load(job_id)
    path = Path(job.get("subtitle_path") or "")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Subtitle not found")
    filename = public_filename(job.get("title"), job_id, ".ass")
    return FileResponse(path, media_type="text/plain", filename=filename)


@router.post("/{job_id}/cancel", response_model=JobPublic, summary="Huỷ job")
def cancel_job(job_id: str):
    job = _load(job_id)
    store = get_store()
    store.update(job_id, cancelled=True, status=JobStatus.CANCELLED.value, message="Cancelled")
    for child_id in job.get("children") or []:
        child = store.get(child_id)
        if child and not is_terminal(child.get("status") or ""):
            store.update(child_id, cancelled=True, status=JobStatus.CANCELLED.value, message="Cancelled")
    return _serialize(store.get(job_id) or job)


@router.post("/{job_id}/retry", response_model=JobPublic, summary="Chạy lại job")
def retry_job(
    job_id: str,
    body: RetryRequest = Body(default_factory=RetryRequest),
    x_douyin_cookie: Optional[str] = Header(default=None, alias="X-Douyin-Cookie"),
):
    job = _load(job_id)
    if job.get("kind") == "batch":
        raise HTTPException(status_code=400, detail="Retry child jobs individually")

    next_cookie = body.cookie or x_douyin_cookie or job.get("cookie") or None
    if isinstance(next_cookie, str):
        next_cookie = next_cookie.strip() or None

    updated = get_store().update(
        job_id,
        status=JobStatus.QUEUED.value,
        progress=0,
        message="Queued",
        error_code=None,
        cancelled=False,
        output_path=None,
        subtitle_path=None,
        cookie=next_cookie,
    )
    enqueue_job(job_id)
    return _serialize(updated or job)


@router.delete("/{job_id}", summary="Xoá job và file tạm")
def delete_job(job_id: str):
    job = _load(job_id)
    store = get_store()
    for path_key in ("output_path", "subtitle_path", "input_path"):
        path = Path(job.get(path_key) or "")
        if path.is_file():
            path.unlink(missing_ok=True)
    from app.core.config import get_settings
    shutil.rmtree(get_settings().temp_dir / job_id, ignore_errors=True)
    for child_id in job.get("children") or []:
        try:
            delete_job(child_id)
        except HTTPException:
            store.delete(child_id)
    store.delete(job_id)
    return {"ok": True, "job_id": job_id}
