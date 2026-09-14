# Hướng dẫn FE dùng Douyin Download API

Base URL hiện tại: `http://127.0.0.1:8001`

Swagger: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)

Prefix API: `/api/v1`

FE **không** gọi Douyin, FFmpeg, Whisper hay Redis. Chỉ tạo job → theo tiến trình → tải file khi xong.

---

## Luồng chuẩn

```
1. POST  /api/v1/videos/process   (hoặc /batch, /upload)
2. Nhận  job_id
3. Poll  GET /api/v1/jobs/{job_id}
   hoặc  SSE GET /api/v1/jobs/{job_id}/events
4. Khi status = completed và download_ready = true
5. GET   /api/v1/jobs/{job_id}/download
6. (nếu insert_subtitle) GET /api/v1/jobs/{job_id}/subtitle
```

Với **user URL** hoặc **batch**, job gốc có `kind: "batch"`. Tải từng video con trong `jobs[]`, không tải file từ job batch.

---

## Header chung

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Content-Type: application/json` | Có (trừ upload) | Body JSON |
| `X-Douyin-Cookie` | Không | Cookie Douyin nếu API bị chặn. Cũng gửi được trong body `cookie` |

CORS đang mở `*`.

---

## 1. Health

`GET /api/v1/health`

```json
{ "status": "ok" }
```

---

## 2. Tải 1 video / 1 user

`POST /api/v1/videos/process`

### Request

```json
{
  "url": "https://www.douyin.com/video/751234567890",
  "insert_subtitle": false,
  "remove_original_subtitle": false,
  "source_language": "zh",
  "target_language": "vi",
  "limit": 0,
  "cookie": null
}
```

| Field | Type | Default | Ý nghĩa |
|---|---|---|---|
| `url` | string | bắt buộc | Link video, share `v.douyin.com`, hoặc trang user |
| `insert_subtitle` | bool | `false` | `true` mới chèn phụ đề Việt. `false` chỉ tải file, không encode |
| `remove_original_subtitle` | bool \| null | tự bật khi `insert_subtitle=true` | Làm mờ phụ đề Trung burned-in. Gửi `false` nếu muốn giữ chữ Trung |
| `source_language` | string | `"zh"` | Ngôn ngữ nhận diện |
| `target_language` | string | `"vi"` | Ngôn ngữ phụ đề |
| `limit` | int | `0` | Số video tối đa nếu URL là user. `0` = mặc định server (50) |
| `cookie` | string \| null | `null` | Cookie Douyin |

### Response `200`

```json
{
  "job_id": "a1b2c3d4e5f6...",
  "kind": "video",
  "status": "queued"
}
```

User URL vẫn trả `kind: "video"` lúc tạo. Worker phân giải xong sẽ đổi job đó thành `kind: "batch"` và sinh job con.

---

## 3. Tải hàng loạt

`POST /api/v1/videos/batch`

Tối đa 50 URL.

```json
{
  "urls": [
    "https://www.douyin.com/video/1",
    "https://www.douyin.com/video/2"
  ],
  "insert_subtitle": true,
  "remove_original_subtitle": false,
  "source_language": "zh",
  "target_language": "vi",
  "limit": 20
}
```

### Response `200`

```json
{
  "batch_id": "aaa...",
  "job_id": "aaa...",
  "kind": "batch",
  "status": "queued"
}
```

`batch_id` và `job_id` giống nhau. FE dùng 1 id này để poll.

---

## 4. Upload file local

`POST /api/v1/videos/upload`

`Content-Type: multipart/form-data`

| Field | Type | Default |
|---|---|---|
| `file` | file | bắt buộc — `mp4`, `mov`, `mkv`, `webm` |
| `insert_subtitle` | bool | `false` |
| `remove_original_subtitle` | bool | `false` |
| `source_language` | string | `zh` |
| `target_language` | string | `vi` |

Response giống `/process`: `{ job_id, kind, status }`.

---

## 5. Tiến trình job (poll)

`GET /api/v1/jobs/{job_id}`

Dùng endpoint này cho progress bar.

### Response `200`

```json
{
  "job_id": "aaa",
  "kind": "video",
  "status": "downloading",
  "progress": 40,
  "message": "Đang tải video",
  "error_code": null,
  "title": "xin chào",
  "aweme_id": "751234567890",
  "insert_subtitle": false,
  "parent_id": null,
  "children": [],
  "jobs": [],
  "download_ready": false,
  "subtitle_ready": false,
  "created_at": 1726320000.0,
  "updated_at": 1726320012.0
}
```

### Job batch

```json
{
  "job_id": "batch-id",
  "kind": "batch",
  "status": "downloading",
  "progress": 55,
  "message": "Đang xử lý 1/3",
  "children": ["child-1", "child-2", "child-3"],
  "jobs": [
    {
      "job_id": "child-1",
      "kind": "video",
      "status": "completed",
      "progress": 100,
      "download_ready": true,
      "title": "video 1"
    }
  ],
  "download_ready": false
}
```

FE:

- Progress tổng: `progress` của job gốc
- List từng video: `jobs[]`
- Nút tải: chỉ hiện khi item đó `download_ready === true`
- **Không** gọi `/download` trên job `kind: "batch"`

---

## 6. Tiến trình realtime (SSE)

`GET /api/v1/jobs/{job_id}/events`

`Content-Type: text/event-stream`

Mỗi lần status/progress/message đổi, server gửi 1 event `data:` chứa **cùng JSON** như `GET /jobs/{job_id}`. Stream tự đóng khi `completed` | `failed` | `cancelled`.

```js
const es = new EventSource(`${API}/api/v1/jobs/${jobId}/events`)

es.onmessage = (event) => {
  const job = JSON.parse(event.data)
  setProgress(job.progress)
  setStatus(job.status)
  setMessage(job.message)

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    es.close()
  }
}
```

Poll dự phòng: `setInterval` 800–1500ms gọi `GET /jobs/{id}` nếu không dùng SSE.

---

## 7. Tải kết quả

### Video

`GET /api/v1/jobs/{job_id}/download`

- Chỉ gọi khi `status === "completed"` và `download_ready === true`
- Response: file `video/mp4` (browser download / blob)
- `409` nếu chưa xong
- `404` nếu mất file

```js
async function downloadVideo(jobId, title) {
  const res = await fetch(`${API}/api/v1/jobs/${jobId}/download`)
  if (!res.ok) throw new Error("Chưa sẵn sàng")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${title || jobId}.mp4`
  a.click()
  URL.revokeObjectURL(url)
}
```

### Phụ đề `.ass`

`GET /api/v1/jobs/{job_id}/subtitle`

Chỉ có khi `insert_subtitle: true` và `subtitle_ready === true`.

---

## 8. Huỷ / retry / xoá

| Method | Path | Ghi chú |
|---|---|---|
| `POST` | `/api/v1/jobs/{job_id}/cancel` | Huỷ job + job con chưa xong |
| `POST` | `/api/v1/jobs/{job_id}/retry` | Chỉ job `kind: "video"`. Có thể gửi lại `cookie` / header `X-Douyin-Cookie` |

| `DELETE` | `/api/v1/jobs/{job_id}` | Xoá job, file tạm, output |

`cancel` / `retry` trả về object job. `DELETE` trả:

```json
{ "ok": true, "job_id": "aaa" }
```

---

## Status & UI

| `status` | Progress gợi ý | UI |
|---|---|---|
| `queued` | 0 | Đang chờ worker |
| `resolving` | ~5 | Đang đọc link Douyin |
| `downloading` | 15–94 | Thanh tải |
| `extracting_audio` | ~45 | Tách audio |
| `transcribing` | ~55 | Nhận diện giọng |
| `translating` | ~72 | Dịch Việt |
| `generating_subtitle` | ~82 | Tạo phụ đề |
| `rendering` | ~90 | Chèn phụ đề vào video |
| `completed` | 100 | Cho tải file |
| `failed` | — | Hiện `message` / `error_code` |
| `cancelled` | 0 | Đã huỷ |

Ba bước phụ đề (`extracting_audio` → `rendering`) **chỉ xuất hiện** khi `insert_subtitle: true`.

Nút **Chèn phụ đề Việt** map thẳng vào field `insert_subtitle`.

---

## `error_code`

| Code | Nghĩa |
|---|---|
| `COOKIE_REQUIRED` | Chưa có cookie — Douyin chặn request |
| `COOKIE_INVALID` | Cookie hết hạn / sai |
| `INVALID_URL` | Không phải link Douyin |
| `UNSUPPORTED_LINK` | Mix / live / music… không hỗ trợ |
| `NO_VIDEO` | Không lấy được video |
| `DOWNLOAD_FAILED` | Tải CDN thất bại |
| `VIDEO_TOO_LARGE` | Vượt giới hạn dung lượng |
| `TRANSCRIPTION_FAILED` | Whisper lỗi |
| `RENDER_FAILED` | FFmpeg chèn sub lỗi |
| `PROCESSING_FAILED` | Lỗi chung |

Khi `COOKIE_REQUIRED` / `COOKIE_INVALID`: highlight ô Cookie trên FE, hiện `error_code` + hướng dẫn, user dán cookie rồi **Retry**.

Hiện `message` cho user. Không hiện stack trace / đường dẫn server.

HTTP:

| Code | Khi nào |
|---|---|
| `400` | Body sai, quá nhiều URL, file không hỗ trợ |
| `404` | Job / file không tồn tại |
| `409` | Download khi job chưa completed |
| `422` | Validation Pydantic |

---

## Ví dụ TypeScript tối thiểu

```ts
const API = "http://127.0.0.1:8001"

type JobStatus =
  | "queued" | "resolving" | "downloading"
  | "extracting_audio" | "transcribing" | "translating"
  | "generating_subtitle" | "rendering"
  | "completed" | "failed" | "cancelled"

interface Job {
  job_id: string
  kind: "video" | "batch"
  status: JobStatus
  progress: number
  message: string
  error_code: string | null
  title: string | null
  insert_subtitle: boolean
  children: string[]
  jobs: Job[]
  download_ready: boolean
  subtitle_ready: boolean
}

export async function createJob(url: string, insertSubtitle: boolean): Promise<string> {
  const res = await fetch(`${API}/api/v1/videos/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, insert_subtitle: insertSubtitle }),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data.job_id as string
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API}/api/v1/jobs/${jobId}`)
  if (!res.ok) throw new Error("Job not found")
  return res.json()
}
```

Checkbox phụ đề:

```tsx
<label>
  <input
    type="checkbox"
    checked={insertSubtitle}
    onChange={(e) => setInsertSubtitle(e.target.checked)}
  />
  Chèn phụ đề Việt
</label>
```

---

## Gợi ý UI

1. Ô nhập URL Douyin
2. Checkbox **Chèn phụ đề Việt** (`insert_subtitle`)
3. Nút **Tải** → `POST /process` (1 URL) hoặc **Tải hàng loạt** → `POST /batch`
4. Progress bar = `progress` + text = `message`
5. Batch: table từng item trong `jobs[]`, mỗi dòng 1 nút tải khi `download_ready`
6. Single: 1 nút **Tải MP4** khi `download_ready`
7. Nếu có sub: thêm **Tải ASS**

Job TTL mặc định 24h. Sau đó `GET` có thể `404`.

---

## CLI test tay

API + worker phải đang chạy.

```bash
python -m app.cli health
python -m app.cli process "https://www.douyin.com/video/xxxxx" --wait --out ./storage/cli
python -m app.cli process "https://www.douyin.com/video/xxxxx" --subtitle --wait --out ./storage/cli
python -m app.cli process "https://www.douyin.com/video/xxxxx" --subtitle --keep-original --wait --out ./storage/cli
python -m app.cli batch "https://..." "https://..." --wait --out ./storage/cli
python -m app.cli upload video.mp4 --subtitle --wait --out ./storage/cli
python -m app.cli status JOB_ID
python -m app.cli watch JOB_ID
python -m app.cli download JOB_ID --out ./storage/cli
python -m app.cli cancel JOB_ID
```

`--base-url` mặc định `http://127.0.0.1:8001`. Cookie: `--cookie` hoặc env `DOUYIN_COOKIE`.

