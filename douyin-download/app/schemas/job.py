from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    QUEUED = "queued"
    RESOLVING = "resolving"
    DOWNLOADING = "downloading"
    EXTRACTING_AUDIO = "extracting_audio"
    TRANSCRIBING = "transcribing"
    TRANSLATING = "translating"
    GENERATING_SUBTITLE = "generating_subtitle"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobKind(str, Enum):
    VIDEO = "video"
    BATCH = "batch"


TERMINAL_STATUSES = {
    JobStatus.COMPLETED.value,
    JobStatus.FAILED.value,
    JobStatus.CANCELLED.value,
}


class JobCreated(BaseModel):
    job_id: str
    kind: JobKind = JobKind.VIDEO
    status: JobStatus = JobStatus.QUEUED


class BatchCreated(BaseModel):
    batch_id: str
    job_id: str
    kind: JobKind = JobKind.BATCH
    status: JobStatus = JobStatus.QUEUED


class JobPublic(BaseModel):
    job_id: str
    kind: JobKind
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: str = ""
    error_code: Optional[str] = None
    title: Optional[str] = None
    aweme_id: Optional[str] = None
    insert_subtitle: bool = False
    parent_id: Optional[str] = None
    children: List[str] = Field(default_factory=list)
    jobs: List["JobPublic"] = Field(default_factory=list)
    download_ready: bool = False
    subtitle_ready: bool = False
    created_at: float = 0
    updated_at: float = 0


class JobEvent(BaseModel):
    job_id: str
    status: JobStatus
    progress: int
    message: str = ""
    error_code: Optional[str] = None


JobPublic.model_rebuild()
