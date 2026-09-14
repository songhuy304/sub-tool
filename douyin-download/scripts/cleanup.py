import time

from app.core.config import get_settings


def cleanup(ttl_seconds: int | None = None) -> int:
    settings = get_settings()
    ttl = ttl_seconds if ttl_seconds is not None else settings.job_ttl_seconds
    cutoff = time.time() - ttl
    removed = 0
    for folder in (settings.temp_dir, settings.outputs_dir, settings.subtitles_dir, settings.uploads_dir):
        if not folder.exists():
            continue
        for path in folder.iterdir():
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            if mtime > cutoff:
                continue
            if path.is_file():
                path.unlink(missing_ok=True)
                removed += 1
            elif path.is_dir():
                import shutil
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
    return removed


if __name__ == "__main__":
    print(f"removed={cleanup()}")
