import { DOUYIN_API_URL } from "@/config/app.config";

const API = DOUYIN_API_URL.replace(/\/$/, "");

export type JobStatus =
  | "queued"
  | "resolving"
  | "downloading"
  | "extracting_audio"
  | "transcribing"
  | "translating"
  | "generating_subtitle"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

/** Known API error codes; cookie blocks map to COOKIE_*. */
export type JobErrorCode =
  | "COOKIE_REQUIRED"
  | "COOKIE_INVALID"
  | "INVALID_URL"
  | "UNSUPPORTED_LINK"
  | "NO_VIDEO"
  | "DOWNLOAD_FAILED"
  | "VIDEO_TOO_LARGE"
  | "TRANSCRIPTION_FAILED"
  | "RENDER_FAILED"
  | "PROCESSING_FAILED"
  | (string & {});

export interface Job {
  job_id: string;
  kind: "video" | "batch";
  status: JobStatus;
  progress: number;
  message: string;
  error_code: JobErrorCode | null;
  title: string | null;
  aweme_id?: string | null;
  insert_subtitle: boolean;
  parent_id?: string | null;
  children: string[];
  jobs: Job[];
  download_ready: boolean;
  subtitle_ready: boolean;
  created_at?: number;
  updated_at?: number;
}

export interface ProcessOptions {
  insert_subtitle?: boolean;
  remove_original_subtitle?: boolean;
  source_language?: string;
  target_language?: string;
  limit?: number;
  cookie?: string | null;
}

export interface CreateJobResponse {
  job_id: string;
  batch_id?: string;
  kind: "video" | "batch";
  status: JobStatus;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { detail?: unknown; message?: string };
    if (typeof json.message === "string") return json.message;
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail)) {
      return json.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: string }).msg)
            : JSON.stringify(d),
        )
        .join("; ");
    }
  } catch {
    // plain text
  }
  return text || `HTTP ${res.status}`;
}

function cookieHeaders(cookie?: string | null): HeadersInit {
  if (!cookie?.trim()) return {};
  return { "X-Douyin-Cookie": cookie.trim() };
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/v1/health`);
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function processVideo(
  url: string,
  options: ProcessOptions = {},
): Promise<CreateJobResponse> {
  const res = await fetch(`${API}/api/v1/videos/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...cookieHeaders(options.cookie),
    },
    body: JSON.stringify({
      url,
      insert_subtitle: options.insert_subtitle ?? false,
      remove_original_subtitle: options.remove_original_subtitle ?? false,
      source_language: options.source_language ?? "zh",
      target_language: options.target_language ?? "vi",
      limit: options.limit ?? 0,
      cookie: options.cookie?.trim() || null,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function processBatch(
  urls: string[],
  options: ProcessOptions = {},
): Promise<CreateJobResponse> {
  const res = await fetch(`${API}/api/v1/videos/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...cookieHeaders(options.cookie),
    },
    body: JSON.stringify({
      urls,
      insert_subtitle: options.insert_subtitle ?? false,
      remove_original_subtitle: options.remove_original_subtitle ?? false,
      source_language: options.source_language ?? "zh",
      target_language: options.target_language ?? "vi",
      limit: options.limit ?? 0,
      cookie: options.cookie?.trim() || null,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function uploadVideo(
  file: File,
  options: ProcessOptions = {},
): Promise<CreateJobResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("insert_subtitle", String(options.insert_subtitle ?? false));
  form.append(
    "remove_original_subtitle",
    String(options.remove_original_subtitle ?? false),
  );
  form.append("source_language", options.source_language ?? "zh");
  form.append("target_language", options.target_language ?? "vi");

  const res = await fetch(`${API}/api/v1/videos/upload`, {
    method: "POST",
    headers: cookieHeaders(options.cookie),
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API}/api/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export function watchJobEvents(
  jobId: string,
  onJob: (job: Job) => void,
  onError?: (err: Event) => void,
): EventSource {
  const es = new EventSource(`${API}/api/v1/jobs/${jobId}/events`);
  es.onmessage = (event) => {
    try {
      const job = JSON.parse(event.data) as Job;
      onJob(job);
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        es.close();
      }
    } catch {
      // ignore malformed events
    }
  };
  es.onerror = (err) => {
    onError?.(err);
  };
  return es;
}

export async function cancelJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API}/api/v1/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function retryJob(
  jobId: string,
  cookie?: string | null,
): Promise<Job> {
  const res = await fetch(`${API}/api/v1/jobs/${jobId}/retry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...cookieHeaders(cookie),
    },
    body: JSON.stringify({ cookie: cookie?.trim() || null }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/jobs/${jobId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}

async function downloadBlob(
  path: string,
  filename: string,
): Promise<void> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadVideo(
  jobId: string,
  title?: string | null,
): Promise<void> {
  const safe = (title || jobId).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 120);
  await downloadBlob(`/api/v1/jobs/${jobId}/download`, `${safe}.mp4`);
}

export async function downloadSubtitle(
  jobId: string,
  title?: string | null,
): Promise<void> {
  const safe = (title || jobId).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 120);
  await downloadBlob(`/api/v1/jobs/${jobId}/subtitle`, `${safe}.ass`);
}

export { API as DOUYIN_API_BASE };
