from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


def resolve_blur_original(insert_subtitle: bool, remove_original_subtitle: Optional[bool]) -> bool:
    if remove_original_subtitle is not None:
        return remove_original_subtitle
    return bool(insert_subtitle)


class ProcessRequest(BaseModel):
    url: str = Field(..., min_length=8, description="Link video hoặc trang user Douyin")
    insert_subtitle: bool = Field(False, description="Chèn phụ đề tiếng Việt sau khi tải")
    remove_original_subtitle: Optional[bool] = Field(
        None,
        description="Làm mờ phụ đề Trung burned-in. Bỏ trống = bật khi insert_subtitle=true",
    )
    source_language: str = Field("zh")
    target_language: str = Field("vi")
    limit: int = Field(0, ge=0, le=200, description="Giới hạn số video khi URL là trang user")
    cookie: Optional[str] = Field(None, description="Cookie Douyin nếu API bị chặn")

    @field_validator("url")
    @classmethod
    def strip_url(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def default_blur_when_subtitle(self):
        self.remove_original_subtitle = resolve_blur_original(
            self.insert_subtitle, self.remove_original_subtitle
        )
        return self


class BatchRequest(BaseModel):
    urls: List[str] = Field(..., min_length=1, max_length=50)
    insert_subtitle: bool = False
    remove_original_subtitle: Optional[bool] = None
    source_language: str = "zh"
    target_language: str = "vi"
    limit: int = Field(0, ge=0, le=200)
    cookie: Optional[str] = None

    @field_validator("urls")
    @classmethod
    def strip_urls(cls, values: List[str]) -> List[str]:
        cleaned = [item.strip() for item in values if item and item.strip()]
        if not cleaned:
            raise ValueError("urls must not be empty")
        return cleaned

    @model_validator(mode="after")
    def default_blur_when_subtitle(self):
        self.remove_original_subtitle = resolve_blur_original(
            self.insert_subtitle, self.remove_original_subtitle
        )
        return self
