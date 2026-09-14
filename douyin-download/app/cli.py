"""CLI test tay API Douyin Download.

Cần API + Redis + worker đang chạy.

    python -m app.cli health
    python -m app.cli process "https://www.douyin.com/video/..." --wait
    python -m app.cli process "https://..." --subtitle --wait --out ./storage/cli
    python -m app.cli batch "https://..." "https://..." --wait
    python -m app.cli upload video.mp4 --subtitle --wait
    python -m app.cli status JOB_ID
    python -m app.cli watch JOB_ID
    python -m app.cli download JOB_ID --out ./out.mp4
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urljoin

import requests

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DEFAULT_BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8001")
TERMINAL = {"completed", "failed", "cancelled"}


class ApiError(RuntimeError):
    pass


class Client:
    def __init__(self, base_url: str, cookie: Optional[str] = None, timeout: int = 30):
        self.base = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        if cookie:
            self.session.headers["X-Douyin-Cookie"] = cookie

    def url(self, path: str) -> str:
        return urljoin(self.base + "/", path.lstrip("/"))

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        kwargs.setdefault("timeout", self.timeout)
        try:
            res = self.session.request(method, self.url(path), **kwargs)
        except requests.ConnectionError as exc:
            raise ApiError(
                f"Không kết nối được API {self.base}. "
                "Chạy uvicorn + celery + redis trước."
            ) from exc
        if res.status_code >= 400:
            detail = res.text
            try:
                detail = res.json().get("detail", detail)
            except Exception:
                pass
            raise ApiError(f"HTTP {res.status_code}: {detail}")
        return res

    def health(self) -> dict:
        return self.request("GET", "/api/v1/health").json()

    def process(self, body: dict) -> dict:
        return self.request("POST", "/api/v1/videos/process", json=body).json()

    def batch(self, body: dict) -> dict:
        return self.request("POST", "/api/v1/videos/batch", json=body).json()

    def upload(self, file_path: Path, extra: dict) -> dict:
        with file_path.open("rb") as handle:
            return self.request(
                "POST",
                "/api/v1/videos/upload",
                files={"file": (file_path.name, handle)},
                data=extra,
                timeout=300,
            ).json()

    def job(self, job_id: str) -> dict:
        return self.request("GET", f"/api/v1/jobs/{job_id}").json()

    def cancel(self, job_id: str) -> dict:
        return self.request("POST", f"/api/v1/jobs/{job_id}/cancel").json()

    def retry(self, job_id: str) -> dict:
        return self.request("POST", f"/api/v1/jobs/{job_id}/retry").json()

    def download_bytes(self, job_id: str) -> bytes:
        return self.request("GET", f"/api/v1/jobs/{job_id}/download", timeout=180).content

    def subtitle_bytes(self, job_id: str) -> bytes:
        return self.request("GET", f"/api/v1/jobs/{job_id}/subtitle", timeout=60).content


def print_job(job: dict, indent: str = "") -> None:
    print(
        f"{indent}[{int(job.get('progress') or 0):3}%] {job.get('status')} | "
        f"{job.get('job_id')} | {job.get('kind')} | {job.get('message') or ''}"
    )
    if job.get("title"):
        print(f"{indent}  title: {job['title']}")
    if job.get("error_code"):
        print(f"{indent}  error: {job['error_code']}")
    if job.get("download_ready"):
        print(f"{indent}  download_ready: true")


def watch(client: Client, job_id: str, interval: float = 0.8) -> dict:
    last = None
    while True:
        job = client.job(job_id)
        snapshot = (job.get("status"), job.get("progress"), job.get("message"))
        if snapshot != last:
            print_job(job)
            for child in job.get("jobs") or []:
                print_job(child, indent="  ")
            last = snapshot
        if job.get("status") in TERMINAL:
            return job
        time.sleep(interval)


def downloadable_ids(job: dict) -> list[dict]:
    if job.get("kind") == "batch":
        return [item for item in (job.get("jobs") or []) if item.get("download_ready")]
    if job.get("download_ready"):
        return [job]
    return []


def save_outputs(client: Client, job: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    items = downloadable_ids(job)
    if not items:
        print("Không có file để tải (job chưa completed hoặc là batch chưa có con).")
        return
    for item in items:
        job_id = item["job_id"]
        name = (item.get("title") or job_id)[:40]
        dest = out_dir / f"{job_id}_{name}.mp4"
        dest.write_bytes(client.download_bytes(job_id))
        print(f"Saved {dest}")
        if item.get("subtitle_ready") or job.get("insert_subtitle"):
            try:
                ass = out_dir / f"{job_id}_{name}.ass"
                ass.write_bytes(client.subtitle_bytes(job_id))
                print(f"Saved {ass}")
            except ApiError:
                pass


def run_and_maybe_wait(
    client: Client,
    created: dict,
    wait: bool,
    out: Optional[str],
) -> int:
    job_id = created.get("job_id") or created.get("batch_id")
    print(f"job_id={job_id} kind={created.get('kind')} status={created.get('status')}")
    if not wait:
        print(f"Theo dõi: python -m app.cli watch {job_id}")
        return 0
    job = watch(client, job_id)
    if out:
        save_outputs(client, client.job(job_id), Path(out))
    return 0 if job.get("status") == "completed" else 1


def subtitle_flags(args) -> dict:
    flags = {"insert_subtitle": bool(getattr(args, "subtitle", False))}
    if getattr(args, "keep_original", False):
        flags["remove_original_subtitle"] = False
    return flags
    p = argparse.ArgumentParser(description="CLI test tay Douyin Download API")
    p.add_argument("--base-url", default=DEFAULT_BASE, help=f"API base (default {DEFAULT_BASE})")
    p.add_argument("--cookie", default=os.getenv("DOUYIN_COOKIE") or None, help="Cookie Douyin")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("health", help="GET /health")

    sp = sub.add_parser("process", help="POST /videos/process")
    sp.add_argument("url")
    sp.add_argument("--subtitle", action="store_true", help="Chèn phụ đề Việt (mặc định làm mờ sub Trung gốc)")
    sp.add_argument("--keep-original", action="store_true", help="Giữ nguyên phụ đề Trung, không blur")
    sp.add_argument("--limit", type=int, default=0, help="Giới hạn video khi URL là user")
    sp.add_argument("--wait", action="store_true", help="Poll đến khi xong")
    sp.add_argument("--out", default=None, help="Thư mục lưu file khi --wait")

    sb = sub.add_parser("batch", help="POST /videos/batch")
    sb.add_argument("urls", nargs="+")
    sb.add_argument("--subtitle", action="store_true")
    sb.add_argument("--keep-original", action="store_true")
    sb.add_argument("--limit", type=int, default=0)
    sb.add_argument("--wait", action="store_true")
    sb.add_argument("--out", default=None)

    su = sub.add_parser("upload", help="POST /videos/upload")
    su.add_argument("file")
    su.add_argument("--subtitle", action="store_true")
    su.add_argument("--keep-original", action="store_true")
    su.add_argument("--wait", action="store_true")
    su.add_argument("--out", default=None)

    st = sub.add_parser("status", help="GET /jobs/{id}")
    st.add_argument("job_id")

    sw = sub.add_parser("watch", help="Poll job đến khi xong")
    sw.add_argument("job_id")

    sd = sub.add_parser("download", help="GET /jobs/{id}/download")
    sd.add_argument("job_id")
    sd.add_argument("--out", required=True, help="File .mp4 hoặc thư mục")

    ss = sub.add_parser("subtitle", help="GET /jobs/{id}/subtitle")
    ss.add_argument("job_id")
    ss.add_argument("--out", required=True)

    sc = sub.add_parser("cancel", help="POST /jobs/{id}/cancel")
    sc.add_argument("job_id")

    sr = sub.add_parser("retry", help="POST /jobs/{id}/retry")
    sr.add_argument("job_id")
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    client = Client(args.base_url, cookie=args.cookie)
    try:
        if args.cmd == "health":
            print(client.health())
            return 0

        if args.cmd == "process":
            created = client.process({
                "url": args.url,
                "limit": args.limit,
                **subtitle_flags(args),
            })
            return run_and_maybe_wait(client, created, args.wait, args.out)

        if args.cmd == "batch":
            created = client.batch({
                "urls": args.urls,
                "limit": args.limit,
                **subtitle_flags(args),
            })
            return run_and_maybe_wait(client, created, args.wait, args.out)

        if args.cmd == "upload":
            path = Path(args.file)
            if not path.is_file():
                raise ApiError(f"Không thấy file: {path}")
            extra = {k: str(v).lower() for k, v in subtitle_flags(args).items()}
            created = client.upload(path, extra)
            return run_and_maybe_wait(client, created, args.wait, args.out)

        if args.cmd == "status":
            job = client.job(args.job_id)
            print_job(job)
            for child in job.get("jobs") or []:
                print_job(child, indent="  ")
            return 0

        if args.cmd == "watch":
            job = watch(client, args.job_id)
            return 0 if job.get("status") == "completed" else 1

        if args.cmd == "download":
            job = client.job(args.job_id)
            out = Path(args.out)
            if out.suffix.lower() == ".mp4" or (out.suffix and not out.exists() and not str(args.out).endswith(("/", "\\"))):
                if job.get("kind") == "batch":
                    raise ApiError("Job batch: dùng --out thư mục, không phải 1 file")
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(client.download_bytes(args.job_id))
                print(f"Saved {out}")
            else:
                save_outputs(client, job, out)
            return 0

        if args.cmd == "subtitle":
            Path(args.out).write_bytes(client.subtitle_bytes(args.job_id))
            print(f"Saved {args.out}")
            return 0

        if args.cmd == "cancel":
            print_job(client.cancel(args.job_id))
            return 0

        if args.cmd == "retry":
            print_job(client.retry(args.job_id))
            return 0

        return 2
    except ApiError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
