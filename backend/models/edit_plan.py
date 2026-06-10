from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from models.result import CutPoint


# ── Timeline primitives ─────────────────────────────────────────────────────────

class TimelineSegment(BaseModel):
    """A kept slice of the source that survives the edit.

    `start`/`end` are timestamps on the OUTPUT timeline (after previous cuts removed).
    `source_start`/`source_end` are the original timestamps in the source media.
    """
    start: float
    end: float
    source_start: float
    source_end: float
    type: str = "keep"          # "keep" | "broll" | "highlight"


class ZoomEvent(BaseModel):
    time: float                 # output-timeline timestamp
    scale: float                # 1.0 = none, 1.3 = 30% punch-in
    center_x: float = 0.5
    center_y: float = 0.5
    duration: float = 0.3       # ramp duration in seconds


class CaptionWordEvent(BaseModel):
    word: str
    start: float                # output-timeline timestamp
    end: float


class CaptionEvent(BaseModel):
    index: int
    start: float
    end: float
    text: str
    words: List[CaptionWordEvent] = Field(default_factory=list)


class MarkerEvent(BaseModel):
    time: float
    label: str
    kind: str = "info"          # "broll" | "chapter" | "viral" | "info"
    query: Optional[str] = None  # b-roll search query, if any


class BeatGrid(BaseModel):
    bpm: float
    beats: List[float] = Field(default_factory=list)


class EditColor(BaseModel):
    brightness: float = 0.0
    contrast: float = 0.0
    saturation: float = 0.0
    temperature: float = 0.0
    tint: float = 0.0
    lut_suggestion: str = ""


# ── The plan ────────────────────────────────────────────────────────────────────

class EditPlan(BaseModel):
    style_id: str
    source_duration: float
    output_duration: float
    target_ratio: Optional[str] = None       # "9:16", "1:1", "16:9" or None (keep)

    segments: List[TimelineSegment] = Field(default_factory=list)
    zooms: List[ZoomEvent] = Field(default_factory=list)
    captions: List[CaptionEvent] = Field(default_factory=list)
    markers: List[MarkerEvent] = Field(default_factory=list)
    beat_grid: Optional[BeatGrid] = None

    color: Optional[EditColor] = None
    audio_gain_db: float = 0.0

    # Raw cuts (source-timeline) — useful for Premiere razoring without re-deriving.
    removed_cuts: List[CutPoint] = Field(default_factory=list)

    stats: Dict[str, float] = Field(default_factory=dict)


class AutoEditResult(BaseModel):
    plan: EditPlan
    render_path: Optional[str] = None
    ass_path: Optional[str] = None           # burned-in caption file used (if any)
