from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    whisper_model: str = "small"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_beam_size: int = 1

    max_video_size_mb: int = 500
    max_video_duration_seconds: int = 1800
    storage_path: str = "./storage"
    job_ttl_seconds: int = 86400
    default_user_limit: int = 50
    max_batch_urls: int = 50

    source_language: str = "zh"
    target_language: str = "vi"
    douyin_cookie: str = ""

    ffmpeg_preset: str = "veryfast"
    ffmpeg_crf: int = 23
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def storage_root(self) -> Path:
        return Path(self.storage_path).resolve()

    @property
    def uploads_dir(self) -> Path:
        return self.storage_root / "uploads"

    @property
    def temp_dir(self) -> Path:
        return self.storage_root / "temp"

    @property
    def outputs_dir(self) -> Path:
        return self.storage_root / "outputs"

    @property
    def subtitles_dir(self) -> Path:
        return self.storage_root / "subtitles"

    def ensure_storage(self) -> None:
        for path in (self.uploads_dir, self.temp_dir, self.outputs_dir, self.subtitles_dir):
            path.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_storage()
    return settings
