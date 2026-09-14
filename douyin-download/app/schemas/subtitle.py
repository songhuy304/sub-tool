from typing import List, Optional, Any, Dict
from dataclasses import dataclass, field, asdict

try:
    from pydantic import BaseModel, Field
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    class BaseModel:
        def model_dump(self) -> Dict[str, Any]:
            if hasattr(self, "__dataclass_fields__"):
                return asdict(self)
            return self.__dict__
        
        def dict(self) -> Dict[str, Any]:
            return self.model_dump()

    def Field(default=..., description: str = "", **kwargs):
        return default


if HAS_PYDANTIC:
    class SubtitleSegment(BaseModel):
        start: float = Field(..., description="Thời điểm bắt đầu (giây)")
        end: float = Field(..., description="Thời điểm kết thúc (giây)")
        text: str = Field(..., description="Nội dung văn bản (gốc)")
        translated_text: Optional[str] = Field(None, description="Nội dung văn bản đã dịch")
        speaker: Optional[str] = Field(None, description="Tên người nói")
        confidence: Optional[float] = Field(None, description="Độ tin cậy của STT")


    class SubtitleStyleConfig(BaseModel):
        font_name: str = Field("Arial", description="Tên phông chữ")
        font_size: int = Field(0, description="Kích thước chữ; 0 = tự tính theo độ phân giải")
        primary_color: str = Field("&H00FFFFFF", description="Màu chữ chính")
        outline_color: str = Field("&H00000000", description="Màu viền")
        back_color: str = Field("&H80000000", description="Màu nền / bóng")
        bold: bool = Field(True, description="In đậm")
        italic: bool = Field(False, description="In nghiêng")
        outline_width: float = Field(3.5, description="Độ dày viền")
        shadow_width: float = Field(2.0, description="Độ rộng bóng")
        alignment: int = Field(2, description="Căn chỉnh")
        margin_l: int = Field(50, description="Lề trái")
        margin_r: int = Field(50, description="Lề phải")
        margin_v: int = Field(0, description="Lề dưới; 0 = tự tính theo độ phân giải")
        max_chars_per_line: int = Field(24, description="Ký tự tối đa/dòng")
        max_lines: int = Field(2, description="Dòng tối đa/phụ đề")
        min_duration: float = Field(0.8, description="Thời gian hiển thị min (giây)")
        max_duration: float = Field(5.0, description="Thời gian hiển thị max (giây)")


    class SubtitleProcessRequest(BaseModel):
        video_path: str = Field(..., description="Đường dẫn file video đầu vào")
        source_lang: str = Field("zh", description="Ngôn ngữ gốc")
        target_lang: str = Field("vi", description="Ngôn ngữ mục tiêu")
        output_path: Optional[str] = Field(None, description="Đường dẫn file video đầu ra")
        style: SubtitleStyleConfig = Field(default_factory=SubtitleStyleConfig, description="Style phụ đề")
        whisper_model: str = Field("small", description="Model Whisper")
        device: str = Field("cpu", description="Thiết bị cpu/cuda")
        remove_original_subtitle: bool = Field(True, description="Làm mờ phụ đề burned-in gốc")


    class TranscriptionResult(BaseModel):
        segments: List[SubtitleSegment]
        language: str
        duration: float


    class TranslationResult(BaseModel):
        segments: List[SubtitleSegment]
        source_lang: str
        target_lang: str


    class PipelineResult(BaseModel):
        success: bool
        output_video_path: str
        subtitle_ass_path: str
        transcription: Optional[TranscriptionResult] = None
        translation: Optional[TranslationResult] = None
        error_message: Optional[str] = None

else:
    @dataclass
    class SubtitleSegment(BaseModel):
        start: float
        end: float
        text: str
        translated_text: Optional[str] = None
        speaker: Optional[str] = None
        confidence: Optional[float] = None


    @dataclass
    class SubtitleStyleConfig(BaseModel):
        font_name: str = "Arial"
        font_size: int = 0
        primary_color: str = "&H00FFFFFF"
        outline_color: str = "&H00000000"
        back_color: str = "&H80000000"
        bold: bool = True
        italic: bool = False
        outline_width: float = 3.5
        shadow_width: float = 2.0
        alignment: int = 2
        margin_l: int = 50
        margin_r: int = 50
        margin_v: int = 0
        max_chars_per_line: int = 24
        max_lines: int = 2
        min_duration: float = 0.8
        max_duration: float = 5.0


    @dataclass
    class SubtitleProcessRequest(BaseModel):
        video_path: str
        source_lang: str = "zh"
        target_lang: str = "vi"
        output_path: Optional[str] = None
        style: SubtitleStyleConfig = field(default_factory=SubtitleStyleConfig)
        whisper_model: str = "small"
        device: str = "cpu"
        remove_original_subtitle: bool = True


    @dataclass
    class TranscriptionResult(BaseModel):
        segments: List[SubtitleSegment]
        language: str
        duration: float


    @dataclass
    class TranslationResult(BaseModel):
        segments: List[SubtitleSegment]
        source_lang: str
        target_lang: str


    @dataclass
    class PipelineResult(BaseModel):
        success: bool
        output_video_path: str
        subtitle_ass_path: str
        transcription: Optional[TranscriptionResult] = None
        translation: Optional[TranslationResult] = None
        error_message: Optional[str] = None
