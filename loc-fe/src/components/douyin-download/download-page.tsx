"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  IconDownload,
  IconPlayerStop,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconLink,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { DOUYIN_API_URL } from "@/config/app.config";
import {
  cancelJob,
  checkHealth,
  deleteJob,
  downloadSubtitle,
  downloadVideo,
  getJob,
  processBatch,
  processVideo,
  retryJob,
  uploadVideo,
  watchJobEvents,
  type Job,
  type JobStatus,
  type ProcessOptions,
} from "@/services/douyin-api";
import { cn } from "@/lib/utils";

type Mode = "single" | "batch" | "upload";

const TERMINAL: JobStatus[] = ["completed", "failed", "cancelled"];

const COOKIE_ERROR_LABEL: Record<"COOKIE_REQUIRED" | "COOKIE_INVALID", string> =
  {
    COOKIE_REQUIRED: "Chưa có cookie — Douyin đang chặn request",
    COOKIE_INVALID: "Cookie hết hạn hoặc sai — lấy cookie mới rồi Retry",
  };

function isCookieError(
  code: string | null | undefined,
): code is "COOKIE_REQUIRED" | "COOKIE_INVALID" {
  return code === "COOKIE_REQUIRED" || code === "COOKIE_INVALID";
}

function findCookieError(job: Job | null): {
  code: "COOKIE_REQUIRED" | "COOKIE_INVALID";
  message: string;
} | null {
  if (!job) return null;
  if (isCookieError(job.error_code)) {
    return { code: job.error_code, message: job.message };
  }
  for (const child of job.jobs ?? []) {
    if (isCookieError(child.error_code)) {
      return { code: child.error_code, message: child.message };
    }
  }
  return null;
}

function statusVariant(
  status: JobStatus,
): "default" | "secondary" | "destructive" | "success" | "outline" {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  if (status === "cancelled") return "outline";
  return "secondary";
}

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

export function DouyinDownloadPage() {
  const [mode, setMode] = useState<Mode>("single");
  const [url, setUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [insertSubtitle, setInsertSubtitle] = useState(false);
  const [removeOriginalSubtitle, setRemoveOriginalSubtitle] = useState(false);
  const [cookie, setCookie] = useState("");
  const [limit, setLimit] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastedCookieRef = useRef<string | null>(null);

  const stopWatching = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startWatching = useCallback(
    (jobId: string) => {
      stopWatching();
      toastedCookieRef.current = null;

      const apply = (next: Job) => {
        const cookieErr = findCookieError(next);
        if (cookieErr) {
          const key = `${next.job_id}:${cookieErr.code}`;
          if (toastedCookieRef.current !== key) {
            toastedCookieRef.current = key;
            toast.error(
              `${cookieErr.code} — ${COOKIE_ERROR_LABEL[cookieErr.code]}`,
            );
          }
        }
        setJob(next);
        if (TERMINAL.includes(next.status)) stopWatching();
      };

      try {
        esRef.current = watchJobEvents(jobId, apply, () => {
          // SSE failed — fall back to poll
          esRef.current?.close();
          esRef.current = null;
          if (pollRef.current) return;
          pollRef.current = setInterval(async () => {
            try {
              const next = await getJob(jobId);
              apply(next);
            } catch {
              // keep polling until TTL / user clears
            }
          }, 1000);
        });
      } catch {
        pollRef.current = setInterval(async () => {
          try {
            const next = await getJob(jobId);
            apply(next);
          } catch {
            // ignore
          }
        }, 1000);
      }
    },
    [stopWatching],
  );

  useEffect(() => {
    checkHealth().then(setApiOk);
    return () => stopWatching();
  }, [stopWatching]);

  const options = (): ProcessOptions => ({
    insert_subtitle: insertSubtitle,
    remove_original_subtitle: insertSubtitle && removeOriginalSubtitle,
    limit,
    cookie: cookie.trim() || null,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let created;
      if (mode === "single") {
        if (!url.trim()) {
          toast.error("Nhập link Douyin");
          return;
        }
        created = await processVideo(url.trim(), options());
      } else if (mode === "batch") {
        const urls = parseUrls(batchUrls);
        if (urls.length === 0) {
          toast.error("Nhập ít nhất 1 URL");
          return;
        }
        if (urls.length > 50) {
          toast.error("Tối đa 50 URL mỗi lần");
          return;
        }
        created = await processBatch(urls, options());
      } else {
        if (!file) {
          toast.error("Chọn file video");
          return;
        }
        created = await uploadVideo(file, options());
      }

      toast.success(`Job ${created.job_id.slice(0, 8)}… đã tạo`);
      const initial = await getJob(created.job_id);
      setJob(initial);
      startWatching(created.job_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tạo job thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!job) return;
    try {
      const next = await cancelJob(job.job_id);
      setJob(next);
      stopWatching();
      toast.message("Đã huỷ job");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Huỷ thất bại");
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const next = await retryJob(jobId, cookie.trim() || null);
      setJob(next);
      startWatching(next.job_id);
      toast.success("Đã retry");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry thất bại");
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    try {
      await deleteJob(job.job_id);
      stopWatching();
      setJob(null);
      toast.message("Đã xoá job");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xoá thất bại");
    }
  };

  const handleDownload = async (
    jobId: string,
    title: string | null | undefined,
    kind: "video" | "subtitle",
  ) => {
    try {
      if (kind === "video") await downloadVideo(jobId, title);
      else await downloadSubtitle(jobId, title);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải thất bại");
    }
  };

  const busy = job != null && !TERMINAL.includes(job.status);
  const cookieError = findCookieError(job);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Douyin Download
            </h1>
            <Badge
              variant={
                apiOk === null ? "outline" : apiOk ? "success" : "destructive"
              }
            >
              API {apiOk === null ? "…" : apiOk ? "online" : "offline"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Tạo job → theo tiến trình → tải MP4 / ASS. Backend:{" "}
            <code className="text-xs">{DOUYIN_API_URL}</code>
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Nguồn video</CardTitle>
            <CardDescription>
              Link video / user Douyin, hàng loạt URL, hoặc upload file local.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["single", "1 URL", IconLink],
                  ["batch", "Hàng loạt", IconDownload],
                  ["upload", "Upload", IconUpload],
                ] as const
              ).map(([value, label, Icon]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={mode === value ? "default" : "outline"}
                  onClick={() => setMode(value)}
                >
                  <Icon />
                  {label}
                </Button>
              ))}
            </div>

            {mode === "single" && (
              <div className="space-y-2">
                <Label htmlFor="douyin-url">URL Douyin</Label>
                <Input
                  id="douyin-url"
                  placeholder="https://www.douyin.com/video/... hoặc v.douyin.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={submitting || busy}
                />
              </div>
            )}

            {mode === "batch" && (
              <div className="space-y-2">
                <Label htmlFor="douyin-batch">URLs (mỗi dòng 1 link, tối đa 50)</Label>
                <Textarea
                  id="douyin-batch"
                  rows={5}
                  placeholder={"https://www.douyin.com/video/1\nhttps://www.douyin.com/video/2"}
                  value={batchUrls}
                  onChange={(e) => setBatchUrls(e.target.value)}
                  disabled={submitting || busy}
                />
              </div>
            )}

            {mode === "upload" && (
              <div className="space-y-2">
                <Label htmlFor="douyin-file">File (mp4 / mov / mkv / webm)</Label>
                <Input
                  id="douyin-file"
                  type="file"
                  accept=".mp4,.mov,.mkv,.webm,video/*"
                  disabled={submitting || busy}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="text-muted-foreground text-xs">{file.name}</p>
                ) : null}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={insertSubtitle}
                    onCheckedChange={(v) => setInsertSubtitle(v === true)}
                    disabled={submitting || busy}
                  />
                  Chèn phụ đề Việt
                </label>
                <label
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    !insertSubtitle && "opacity-50",
                  )}
                >
                  <Checkbox
                    checked={removeOriginalSubtitle}
                    onCheckedChange={(v) =>
                      setRemoveOriginalSubtitle(v === true)
                    }
                    disabled={!insertSubtitle || submitting || busy}
                  />
                  Làm mờ phụ đề Trung gốc
                </label>
              </div>

              {(mode === "single" || mode === "batch") && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="limit" className="whitespace-nowrap text-xs">
                    Limit user
                  </Label>
                  <Input
                    id="limit"
                    type="number"
                    min={0}
                    max={50}
                    className="w-20"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value) || 0)}
                    disabled={submitting || busy}
                  />
                </div>
              )}
            </div>

            <div
              className={cn(
                "space-y-2 rounded-md p-3 -m-1",
                cookieError
                  ? "ring-2 ring-destructive/60 bg-destructive/5"
                  : null,
              )}
            >
              <Label htmlFor="cookie">
                Cookie Douyin
                {cookieError ? " (bắt buộc)" : " (tuỳ chọn)"}
              </Label>
              <Textarea
                id="cookie"
                rows={2}
                placeholder="Dán cookie nếu API bị chặn (sessionid; ttwid; msToken)…"
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                disabled={submitting || busy}
                aria-invalid={cookieError != null}
              />
              {cookieError ? (
                <div className="space-y-1 text-xs">
                  <p className="text-destructive font-medium">
                    {cookieError.code} —{" "}
                    {COOKIE_ERROR_LABEL[cookieError.code]}
                  </p>
                  {cookieError.message ? (
                    <p className="text-muted-foreground">
                      {cookieError.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleSubmit}
                isLoading={submitting}
                disabled={busy}
              >
                <IconDownload />
                {mode === "batch" ? "Tải hàng loạt" : "Tải"}
              </Button>
              {busy ? (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <IconPlayerStop />
                  Huỷ
                </Button>
              ) : null}
              {job ? (
                <Button type="button" variant="ghost" onClick={handleDelete}>
                  <IconTrash />
                  Xoá job
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {job ? (
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    {job.title || `Job ${job.job_id.slice(0, 12)}…`}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {job.job_id} · {job.kind}
                  </CardDescription>
                </div>
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {job.message || "Đang xử lý…"}
                  </span>
                  <span className="tabular-nums">{job.progress}%</span>
                </div>
                <Progress value={job.progress} />
                {job.error_code ? (
                  <p className="text-destructive text-sm">
                    {isCookieError(job.error_code)
                      ? `${job.error_code} — ${COOKIE_ERROR_LABEL[job.error_code]}`
                      : `${job.error_code}: ${job.message}`}
                  </p>
                ) : null}
              </div>

              {job.kind === "video" && job.download_ready ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      handleDownload(job.job_id, job.title, "video")
                    }
                  >
                    <IconDownload />
                    Tải MP4
                  </Button>
                  {job.subtitle_ready ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDownload(job.job_id, job.title, "subtitle")
                      }
                    >
                      Tải ASS
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {job.kind === "video" && job.status === "failed" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry(job.job_id)}
                >
                  <IconRefresh />
                  Retry
                </Button>
              ) : null}

              {job.kind === "batch" && job.jobs?.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Video</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">%</th>
                        <th className="px-3 py-2 font-medium">Tải</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.jobs.map((child) => (
                        <tr key={child.job_id} className="border-t">
                          <td className="max-w-[220px] truncate px-3 py-2">
                            {child.title || child.job_id.slice(0, 10)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <Badge variant={statusVariant(child.status)}>
                                {child.status}
                              </Badge>
                              {isCookieError(child.error_code) ? (
                                <span className="text-destructive text-xs">
                                  {child.error_code}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {child.progress}%
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {child.download_ready ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleDownload(
                                      child.job_id,
                                      child.title,
                                      "video",
                                    )
                                  }
                                >
                                  MP4
                                </Button>
                              ) : null}
                              {child.subtitle_ready ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleDownload(
                                      child.job_id,
                                      child.title,
                                      "subtitle",
                                    )
                                  }
                                >
                                  ASS
                                </Button>
                              ) : null}
                              {child.status === "failed" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRetry(child.job_id)}
                                >
                                  Retry
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
