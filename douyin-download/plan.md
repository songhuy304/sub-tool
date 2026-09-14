# Douyin Video Subtitle API - Development Plan

## 1. Project Overview

Build a Python-based video processing API for Douyin videos.

The API receives video files or Douyin video URLs from the frontend and provides:

- Download Douyin videos
- Extract audio
- Speech-to-text for Chinese speech
- Translate Chinese → Vietnamese
- Generate Vietnamese subtitles
- Optionally detect and remove burned-in Chinese subtitles
- Burn Vietnamese subtitles into the video
- Process single or batch videos
- Return downloadable processed videos
- Provide processing progress

The backend must be API-first so that any frontend can consume it.

---

# 2. Core Architecture

Frontend
    |
    | HTTP / SSE
    v
FastAPI
    |
    +----------------------+
    |                      |
    v                      v
Redis Queue            File Storage
    |
    v
Python Worker
    |
    +-- FFmpeg
    +-- faster-whisper
    +-- Translation
    +-- PaddleOCR
    +-- OpenCV
    +-- Subtitle Renderer
    |
    v
Processed Video


No database is required.

Redis is used only for:
- Job queue
- Job status
- Progress
- Temporary metadata

Filesystem is used for:
- Original videos
- Temporary files
- Processed videos
- Subtitle files

---

# 3. Technology Stack

## Backend

- Python 3.11+
- FastAPI
- Pydantic v2
- Uvicorn

## Queue

- Redis
- Celery OR RQ

Preferred:
- Redis + Celery

Reason:
- Supports background jobs
- Supports retries
- Supports multiple workers
- Easy to scale later

## Video Processing

- FFmpeg
- FFprobe
- Python subprocess
- OpenCV

## Speech Recognition

Primary:

- faster-whisper

Supported languages:

- Chinese
- Vietnamese
- English
- Japanese
- Korean

Initial target:

Chinese → Vietnamese

Recommended models:

- small
- medium
- large-v3

GPU:

- NVIDIA CUDA
- float16

CPU fallback:

- int8

## OCR

Primary:

- PaddleOCR

Purpose:

- Detect burned-in subtitles
- Detect subtitle bounding boxes
- Determine subtitle position

OCR is NOT used as the main speech recognition system.

## Translation

Architecture must abstract translation provider.

Create:

TranslationProvider

Implement:

- OpenAITranslationProvider
- GoogleTranslationProvider
- LocalTranslationProvider

Initial recommended provider:

OpenAI API

The translation layer must be replaceable.

## Subtitle

Use:

- pysubs2
- ASS subtitle format

Why ASS:

- Position control
- Font control
- Outline
- Shadow
- Size
- Alignment
- Mobile/social-media friendly styling

## Storage

Initial:

Local filesystem

Example:

storage/

    uploads/
    temp/
    outputs/
    subtitles/

No database.

Later optional:

S3 / Cloudflare R2

---

# 4. Main Features

## 4.1 Single Video Processing

Input:

- Douyin URL
OR
- Uploaded video

Example:

POST /api/v1/videos/process

Request:

{
    "url": "https://...",
    "source_language": "zh",
    "target_language": "vi",
    "remove_original_subtitle": false,
    "subtitle_style": "default"
}

Response:

{
    "job_id": "uuid",
    "status": "queued"
}

---

# 5. Batch Processing

Support multiple videos.

Example:

POST /api/v1/videos/batch

Request:

{
    "videos": [
        {
            "url": "https://..."
        },
        {
            "url": "https://..."
        }
    ],
    "source_language": "zh",
    "target_language": "vi",
    "remove_original_subtitle": true
}

Response:

{
    "batch_id": "uuid",
    "job_ids": [
        "uuid-1",
        "uuid-2"
    ]
}

Each video should be processed independently.

One failed video must not stop the entire batch.

---

# 6. Job Lifecycle

Statuses:

QUEUED
PROCESSING
DOWNLOADING
EXTRACTING_AUDIO
TRANSCRIBING
TRANSLATING
DETECTING_SUBTITLE
REMOVING_SUBTITLE
GENERATING_SUBTITLE
RENDERING
COMPLETED
FAILED

Progress:

0 - 100

Example:

{
    "job_id": "xxx",
    "status": "TRANSCRIBING",
    "progress": 42
}

---

# 7. Processing Pipeline

## Step 1 - Download

If input is a Douyin URL:

Download video.

Downloader must be isolated:

app/services/downloader/

Interface:

VideoDownloader

Implementation:

DouyinDownloader

Do not tightly couple downloader logic to processing logic.

---

# 8. Step 2 - Validate Video

Use FFprobe.

Check:

- file exists
- duration
- width
- height
- fps
- codec
- audio stream
- video stream

Reject:

- corrupted files
- unsupported formats
- empty audio when speech processing is required

---

# 9. Step 3 - Extract Audio

FFmpeg:

Video
  |
  v
Audio WAV

Recommended:

- mono
- 16 kHz
- PCM

Example:

ffmpeg -i input.mp4 \
    -ar 16000 \
    -ac 1 \
    audio.wav

---

# 10. Step 4 - Speech Recognition

Use faster-whisper.

Input:

audio.wav

Output:

Transcript segments.

Example:

[
    {
        "start": 0.4,
        "end": 2.8,
        "text": "大家好，今天给大家介绍一个产品"
    }
]

Must preserve:

- start
- end
- text

Optional:

- confidence
- language

---

# 11. Step 5 - Translation

Translate subtitle segments.

Input:

Chinese:

大家好，今天给大家介绍一个产品

Output:

Vietnamese:

Xin chào mọi người, hôm nay mình sẽ giới thiệu
một sản phẩm.

Important:

Translation should understand context.

DO NOT translate every segment completely independently.

Group nearby subtitle segments when necessary.

Preserve timing.

Example:

[
    {
        "start": 0.4,
        "end": 2.8,
        "source": "...",
        "translated": "..."
    }
]

---

# 12. Step 6 - Detect Existing Chinese Subtitle

Only execute if:

remove_original_subtitle = true

Use:

PaddleOCR

Detect text boxes from video frames.

Need to identify:

- Chinese text
- subtitle position
- subtitle region
- persistent text across frames

Do NOT process every frame initially.

Sample frames.

Example:

1 frame / second

Then determine persistent subtitle regions.

---

# 13. Step 7 - Remove Chinese Subtitle

Implement multiple strategies.

Strategy 1:

Crop

Strategy 2:

Blur

Strategy 3:

Mask

Strategy 4:

Inpainting

Preferred architecture:

SubtitleRemover

Implement:

CropSubtitleRemover
BlurSubtitleRemover
InpaintSubtitleRemover

Default:

InpaintSubtitleRemover

The implementation must be replaceable.

Do not hard-code removal logic inside the main pipeline.

---

# 14. Step 8 - Generate ASS Subtitle

Generate:

output.ass

Example style:

Font:

Arial

Font size:

18-24 depending on resolution

Color:

White

Outline:

Black

Shadow:

Black

Alignment:

Bottom center

Margin:

Safe area for TikTok/Douyin/Reels

Subtitle must support:

- line wrapping
- max characters per line
- minimum display duration
- maximum display duration

---

# 15. Subtitle Timing

Avoid:

0.1 second subtitle flashes.

Minimum subtitle duration:

0.8 sec

Maximum subtitle duration:

5 sec

Gap between subtitles:

small gap when appropriate

Subtitle timing should be based on Whisper timestamps.

---

# 16. Step 9 - Render Video

Use FFmpeg.

Input:

clean_video.mp4
+
output.ass

Output:

final.mp4

Requirements:

- H.264
- AAC
- MP4
- Faststart enabled

Example:

-c:v libx264
-c:a aac
-movflags +faststart

---

# 17. API Endpoints

## Health

GET /api/v1/health

Response:

{
    "status": "ok"
}

---

## Process Single Video

POST /api/v1/videos/process

Supports:

- URL
- uploaded file

---

## Process Batch

POST /api/v1/videos/batch

Supports:

- multiple URLs
- multiple uploaded videos

---

## Get Job Status

GET /api/v1/jobs/{job_id}

Response:

{
    "job_id": "xxx",
    "status": "TRANSCRIBING",
    "progress": 45,
    "message": "Recognizing speech"
}

---

## Download Result

GET /api/v1/jobs/{job_id}/download

Returns:

video/mp4

---

## Get Subtitle

GET /api/v1/jobs/{job_id}/subtitle

Returns:

.ass

---

## Cancel Job

POST /api/v1/jobs/{job_id}/cancel

---

## Retry Job

POST /api/v1/jobs/{job_id}/retry

---

## Delete Job

DELETE /api/v1/jobs/{job_id}

Delete:

- temp files
- output files
- Redis job metadata

---

# 18. Real-time Progress

Preferred:

Server-Sent Events (SSE)

Endpoint:

GET /api/v1/jobs/{job_id}/events

Example:

event:

{
    "status": "TRANSCRIBING",
    "progress": 42
}

Frontend can listen:

EventSource(
    `/api/v1/jobs/${jobId}/events`
)

WebSocket can be added later.

Do not require WebSocket for MVP.

---

# 19. Project Structure

app/

    main.py

    api/
        routes/
            health.py
            videos.py
            jobs.py

    core/
        config.py
        logging.py

    schemas/
        video.py
        job.py
        subtitle.py

    services/
        downloader/
            base.py
            douyin.py

        video/
            ffmpeg.py
            probe.py

        speech/
            base.py
            whisper.py

        translation/
            base.py
            openai.py

        ocr/
            base.py
            paddle.py

        subtitle/
            generator.py
            ass.py

        removal/
            base.py
            crop.py
            blur.py
            inpaint.py

        pipeline/
            processor.py

    workers/
        celery_app.py
        tasks.py

    utils/
        files.py
        uuid.py
        time.py

storage/

    uploads/
    temp/
    outputs/
    subtitles/

tests/

    test_health.py
    test_video.py
    test_subtitle.py
    test_translation.py
    test_pipeline.py

scripts/

    cleanup.py

Dockerfile
docker-compose.yml
requirements.txt
.env.example
README.md
PLAN.md

---

# 20. Design Principles

## Stateless API

Do not store application state in PostgreSQL/MySQL.

All temporary job state:

Redis

All files:

Filesystem

---

## Service abstraction

Each major component must have an interface.

Example:

SpeechRecognizer

TranslationProvider

VideoDownloader

SubtitleDetector

SubtitleRemover

SubtitleGenerator

This allows implementations to be replaced.

---

# 21. Configuration

Use environment variables.

Example:

APP_ENV=development

REDIS_URL=redis://localhost:6379/0

OPENAI_API_KEY=

WHISPER_MODEL=small

WHISPER_DEVICE=cuda

WHISPER_COMPUTE_TYPE=float16

MAX_VIDEO_SIZE_MB=500

MAX_VIDEO_DURATION_SECONDS=1800

STORAGE_PATH=./storage

TARGET_LANGUAGE=vi

---

# 22. GPU

The application must support:

CPU mode

and

NVIDIA GPU mode.

GPU is strongly recommended for:

- faster-whisper
- OCR
- inpainting

Docker GPU support should be prepared.

Example:

NVIDIA Container Toolkit

---

# 23. Error Handling

Every job must catch errors.

Example:

{
    "job_id": "xxx",
    "status": "FAILED",
    "error_code": "TRANSCRIPTION_FAILED",
    "message": "Unable to transcribe audio"
}

Never expose:

- stack traces
- API keys
- internal filesystem paths

to frontend users.

Detailed errors go to logs.

---

# 24. Cleanup

Since there is no DB, storage cleanup is important.

Each job gets:

storage/temp/{job_id}/

Example:

storage/temp/abc123/

    input.mp4
    audio.wav
    clean.mp4
    subtitle.ass

Final:

storage/outputs/abc123.mp4

After configurable TTL:

Delete temporary files.

Optionally delete completed output after:

24 hours
48 hours
7 days

Make TTL configurable.

---

# 25. Security

Implement:

- file size limit
- video duration limit
- MIME validation
- filename sanitization
- path traversal protection
- URL validation
- subprocess argument safety
- rate limiting
- request timeout

Never construct shell commands using unsafe user input.

Use subprocess with argument arrays.

---

# 26. Performance

Important:

Do NOT process video directly inside FastAPI request handlers.

FastAPI:

receive request
    ↓
create job
    ↓
push Redis queue
    ↓
return job_id

Worker:

process job

This keeps API responsive.

---

# 27. Parallel Processing

Batch processing should support multiple workers.

Example:

Worker 1 → Video A

Worker 2 → Video B

Worker 3 → Video C

However:

GPU workers must be configurable.

Default:

1 GPU worker

because multiple Whisper models can consume large amounts of VRAM.

Configuration:

MAX_CONCURRENT_GPU_JOBS=1

---

# 28. Logging

Use Python logging.

Every job must include:

job_id

Example:

[abc123] Downloading video
[abc123] Extracting audio
[abc123] Transcribing
[abc123] Translating
[abc123] Rendering
[abc123] Completed

---

# 29. API Documentation

FastAPI automatically provides:

/docs

/redoc

All endpoints must have:

- summary
- description
- request schema
- response schema
- error responses

---

# 30. Testing

Unit tests:

- subtitle timing
- subtitle generation
- translation adapter
- FFmpeg command generation
- file validation

Integration tests:

- complete video pipeline
- API → queue → worker
- job status
- download result

Do not require GPU for unit tests.

Mock Whisper in tests.

---

# 31. Development Phases

## Phase 1 - MVP

Implement:

- FastAPI
- Redis
- Celery
- upload video
- FFmpeg
- faster-whisper
- translation
- ASS generation
- render video
- job status
- download result

Target:

Video with Chinese speech
→ Vietnamese subtitle

No OCR yet.

---

## Phase 2 - Douyin Downloader

Implement:

- Douyin URL input
- downloader abstraction
- video validation
- download progress

Target:

Douyin URL
→ processed Vietnamese video

---

## Phase 3 - Batch

Implement:

- batch API
- multiple jobs
- independent failures
- batch progress

---

## Phase 4 - OCR

Implement:

- PaddleOCR
- subtitle detection
- subtitle position detection
- persistent subtitle detection

---

## Phase 5 - Subtitle Removal

Implement:

- crop
- blur
- mask
- inpainting

Allow frontend to select:

remove_mode

Values:

none
crop
blur
inpaint

---

## Phase 6 - SSE

Implement:

GET /jobs/{job_id}/events

Frontend receives real-time progress.

---

## Phase 7 - Optimization

Optimize:

- Whisper model loading
- GPU memory
- FFmpeg encoding
- temporary files
- parallel workers
- caching

Whisper model should NOT be loaded for every job.

Load model once per worker.

---

# 32. Frontend Contract

Frontend should only need to know:

1. Submit job

POST /api/v1/videos/process

2. Receive job_id

3. Watch progress

GET /api/v1/jobs/{job_id}

or SSE

4. When completed

GET /api/v1/jobs/{job_id}/download

Frontend should NOT know:

- FFmpeg
- Whisper
- PaddleOCR
- Redis
- internal filesystem
- worker implementation

---

# 33. Future Features

Possible later features:

- Vietnamese voice-over
- AI voice cloning
- Automatic subtitle styling
- Multiple translation languages
- English
- Korean
- Japanese
- TikTok format
- YouTube Shorts format
- Instagram Reels format
- Auto resize 9:16
- Remove watermark
- Background music
- Voice separation
- Speaker detection
- Multiple speakers
- Batch ZIP download

These should NOT be implemented in MVP.

---

# 34. MVP Definition of Done

The MVP is complete when:

User sends:

POST /api/v1/videos/process

with a video containing Chinese speech.

Backend:

1. Creates job
2. Adds job to Redis
3. Worker receives job
4. Extracts audio
5. Runs faster-whisper
6. Gets Chinese transcript
7. Translates Chinese → Vietnamese
8. Generates ASS subtitle
9. Burns subtitle with FFmpeg
10. Stores output
11. Marks job COMPLETED

Frontend can then:

GET /api/v1/jobs/{job_id}

and:

GET /api/v1/jobs/{job_id}/download

to download the final MP4.

No database is required.

---

# 35. Recommended Initial Implementation Order

1. Project setup
2. FastAPI
3. Health endpoint
4. FFmpeg service
5. Local video upload
6. faster-whisper service
7. Translation service
8. ASS subtitle generator
9. Complete local pipeline
10. Redis
11. Celery
12. Background jobs
13. Job status API
14. Download API
15. Douyin downloader
16. Batch processing
17. SSE
18. PaddleOCR
19. Subtitle removal
20. Inpainting
21. Performance optimization
22. Docker deployment

Do not start with OCR/inpainting.

First make:

video → speech → translation → subtitle → final video

work reliably.