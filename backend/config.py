import os
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "KADE AutoEdit AI"
    APP_VERSION: str = "1.0.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8472
    DEBUG: bool = False

    # Audio processing
    SILENCE_THRESHOLD: float = -40.0  # dB
    MIN_SILENCE_DURATION: float = 0.5  # seconds
    FADE_DURATION: float = 0.05  # seconds
    KEEP_PADDING_MS: int = 100  # ms padding around kept segments

    # Whisper
    WHISPER_MODEL: str = "base"
    WHISPER_LANGUAGE: str = "tr"

    # Beat sync
    BEAT_SENSITIVITY: float = 0.8  # 0.0-1.0

    # Scene detection
    SCENE_THRESHOLD: float = 30.0

    # Audio normalization
    TARGET_LUFS: float = -14.0

    # Paths
    BASE_DIR: Path = Path(__file__).parent
    OUTPUT_DIR: Path = BASE_DIR / "output"
    TEMP_DIR: Path = BASE_DIR / "temp"
    DB_PATH: str = str(BASE_DIR / "kade_autoedit.db")

    FILLER_WORDS: list = [
        "eee", "mmm", "şey", "yani", "işte", "hani",
        "ee", "um", "uh", "hmm", "aaa", "öö"
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production", "false", "0", "no", "off"}:
                return False
            if normalized in {"debug", "dev", "development", "true", "1", "yes", "on"}:
                return True
        return value

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        self.TEMP_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
