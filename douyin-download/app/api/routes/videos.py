from typing import Optional

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.job import BatchCreated, JobCreated, JobKind, JobStatus
from app.schemas.video import BatchRequest, ProcessRequest, resolve_blur_original
from app.services.jobs.store import get_store
from app.utils.files import safe_filename
from app.workers.enqueue import enqueue_job

router = APIRouter(prefix="/videos", tags=["videos"])


def _cookie(body_cookie: Optional[str], header_cookie: Optional[str]) -> Optional[str]:
    return (body_cookie or header_cookie or get_settings().douyin_cookie or None)


@router.post(
    "/process",
    response_model=JobCreated,
    summary="Tải 1 video Douyin (hoặc user URL sẽ tách thành batch trong worker)",
)
def process_video(
    body: ProcessRequest,
    x_douyin_cookie: Optional[str] = Header(default=None, alias="X-Douyin-Cookie"),
):
    store = get_store()
    job = store.create(
        kind=JobKind.VIDEO.value,
        status=JobStatus.QUEUED.value,
        url=body.url,
        insert_subtitle=body.insert_subtitle,
        remove_original_subtitle=body.remove_original_subtitle,
        source_language=body.source_language,
        target_language=body.target_language,
        limit=body.limit,
        cookie=_cookie(body.cookie, x_douyin_cookie),
        message="Queued",
    )
    enqueue_job(job["job_id"])
    return JobCreated(job_id=job["job_id"], kind=JobKind.VIDEO, status=JobStatus.QUEUED)


@router.post(
    "/batch",
    response_model=BatchCreated,
    summary="Tải hàng loạt URL Douyin",
)
def process_batch(
    body: BatchRequest,
    x_douyin_cookie: Optional[str] = Header(default=None, alias="X-Douyin-Cookie"),
):
    settings = get_settings()
    if len(body.urls) > settings.max_batch_urls:
        raise HTTPException(status_code=400, detail="Too many URLs")
    store = get_store()
    job = store.create(
        kind=JobKind.BATCH.value,
        status=JobStatus.QUEUED.value,
        urls=body.urls,
        insert_subtitle=body.insert_subtitle,
        remove_original_subtitle=body.remove_original_subtitle,
        source_language=body.source_language,
        target_language=body.target_language,
        limit=body.limit,
        cookie=_cookie(body.cookie, x_douyin_cookie),
        message="Queued",
    )
    enqueue_job(job["job_id"])
    return BatchCreated(
        batch_id=job["job_id"],
        job_id=job["job_id"],
        kind=JobKind.BATCH,
        status=JobStatus.QUEUED,
    )


@router.post(
    "/upload",
    response_model=JobCreated,
    summary="Upload file video rồi xử lý (tùy chọn chèn phụ đề Việt)",
)
async def upload_video(
    file: UploadFile = File(...),
    insert_subtitle: bool = Form(False),
    remove_original_subtitle: Optional[bool] = Form(None),
    source_language: str = Form("zh"),
    target_language: str = Form("vi"),
):
    settings = get_settings()
    suffix = (file.filename or "video.mp4").rsplit(".", 1)
    ext = suffix[-1].lower() if len(suffix) == 2 else "mp4"
    if ext not in {"mp4", "mov", "mkv", "webm"}:
        raise HTTPException(status_code=400, detail="Unsupported video format")

    store = get_store()
    job = store.create(
        kind=JobKind.VIDEO.value,
        insert_subtitle=insert_subtitle,
        remove_original_subtitle=resolve_blur_original(insert_subtitle, remove_original_subtitle),
        source_language=source_language,
        target_language=target_language,
        title=safe_filename(file.filename or "upload"),
        message="Queued",
    )
    dest = settings.uploads_dir / f"{job['job_id']}.{ext}"
    size = 0
    max_bytes = settings.max_video_size_mb * 1024 * 1024
    with dest.open("wb") as handle:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                dest.unlink(missing_ok=True)
                store.delete(job["job_id"])
                raise HTTPException(status_code=400, detail="VIDEO_TOO_LARGE")
            handle.write(chunk)
    store.update(job["job_id"], input_path=str(dest), play_url="file://local")
    enqueue_job(job["job_id"])
    return JobCreated(job_id=job["job_id"], kind=JobKind.VIDEO, status=JobStatus.QUEUED)
