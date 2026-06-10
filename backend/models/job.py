from enum import Enum
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


class JobType(str, Enum):
    SILENCE_CUT = "SILENCE_CUT"
    TRANSCRIPT = "TRANSCRIPT"
    BEAT_SYNC = "BEAT_SYNC"
    SCENE_DETECT = "SCENE_DETECT"
    AUTO_COLOR = "AUTO_COLOR"
    ANALYZE = "ANALYZE"
    AUTO_CAPTIONS = "AUTO_CAPTIONS"
    AUTO_ZOOM = "AUTO_ZOOM"
    VIRAL_DETECT = "VIRAL_DETECT"
    PODCAST_MODE = "PODCAST_MODE"
    REPEAT_DETECT = "REPEAT_DETECT"
    PROFANITY_FILTER = "PROFANITY_FILTER"
    AUTO_CHAPTERS = "AUTO_CHAPTERS"
    AUTO_RESIZE = "AUTO_RESIZE"
    BROLL_SUGGEST = "BROLL_SUGGEST"
    AUTO_EDIT = "AUTO_EDIT"
    MEME_FIND = "MEME_FIND"


class Job(BaseModel):
    id: str
    status: JobStatus = JobStatus.PENDING
    type: JobType
    input_file: Optional[str] = None
    output_data: Optional[Any] = None
    progress: float = 0.0
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class JobResult(BaseModel):
    job_id: str
    status: JobStatus
    result: Optional[Any] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None
