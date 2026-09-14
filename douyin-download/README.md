# Douyin Download API

Server FastAPI + Celery worker: tải video Douyin (lẻ / hàng loạt), job progress, tuỳ chọn chèn phụ đề tiếng Việt.

FE chỉ cần gọi API — không chạy CLI.

## Chạy nhanh

Cần: Python 3.11+, Redis, FFmpeg (`ffmpeg` trong PATH).

```bash
cp .env.example .env
pip install -r requirements.txt
```

Terminal 1 — Redis:

```bash
docker run --name redis -p 6379:6379 -d redis:7-alpine
```

Terminal 2 — API:

```bash
uvicorn app.main:app --reload --port 8000
```

Terminal 3 — Worker (Windows dùng `--pool=solo`):

```bash
celery -A app.workers.celery_app worker --loglevel=info --pool=solo
```

Docs: http://127.0.0.1:8001/docs

Hướng dẫn FE gọi API: [docs/FE-API.md](docs/FE-API.md)

## CLI test tay

API + worker phải đang chạy.

```bash
python -m app.cli health
python -m app.cli process "https://www.douyin.com/video/xxxxx" --wait --out ./storage/cli
python -m app.cli process "https://www.douyin.com/video/xxxxx" --subtitle --wait --out ./storage/cli
python -m app.cli batch "https://..." "https://..." --wait --out ./storage/cli
python -m app.cli status JOB_ID
python -m app.cli watch JOB_ID
python -m app.cli download JOB_ID --out ./storage/cli
```

Mặc định gọi `http://127.0.0.1:8001`. Đổi bằng `--base-url` hoặc env `API_BASE_URL`.

Hoặc `docker compose up --build`.

## API cho FE

### Tải 1 video

`POST /api/v1/videos/process`

```json
{
  "url": "https://www.douyin.com/video/...",
  "insert_subtitle": false
}
```

`insert_subtitle: true` thì worker mới chạy Whisper → dịch Việt → burn phụ đề. Tắt thì chỉ tải file, không encode lại.

### Hàng loạt

`POST /api/v1/videos/batch`

```json
{
  "urls": ["https://...", "https://..."],
  "insert_subtitle": true,
  "limit": 20
}
```

User URL được worker tách thành từng job video.

### Tiến trình

- `GET /api/v1/jobs/{job_id}` — poll progress `0-100`, `status`, `message`
- `GET /api/v1/jobs/{job_id}/events` — SSE
- `GET /api/v1/jobs/{job_id}/download` — file mp4 khi `status=completed`
- `GET /api/v1/jobs/{job_id}/subtitle` — file `.ass` nếu có phụ đề
- `POST /api/v1/jobs/{job_id}/cancel`
- `DELETE /api/v1/jobs/{job_id}`

Cookie Douyin (nếu API bị chặn): header `X-Douyin-Cookie` hoặc field `cookie` / env `DOUYIN_COOKIE`.

## Job status

`queued` → `resolving` → `downloading` → (`extracting_audio` → `transcribing` → `translating` → `generating_subtitle` → `rendering`) → `completed` | `failed` | `cancelled`

Các bước phụ đề chỉ chạy khi `insert_subtitle=true`.
