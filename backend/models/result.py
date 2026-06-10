from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ── Shared ─────────────────────────────────────────────────────────────────────

class CutPoint(BaseModel):
    start: float
    end: float
    type: str = "cut"
    label: Optional[str] = None
    confidence: Optional[float] = None


class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    is_filler: bool = False


class Scene(BaseModel):
    start: float
    end: float
    score: float
    frame_start: int
    frame_end: int


# ── Existing modules ───────────────────────────────────────────────────────────

class AnalysisResult(BaseModel):
    duration: float
    fps: float
    resolution: str
    has_audio: bool
    audio_channels: int
    audio_sample_rate: int
    file_size: int
    codec: str


class SilenceCutResult(BaseModel):
    cut_points: List[CutPoint]
    total_silence_duration: float
    total_kept_duration: float
    cuts_count: int


class TranscriptResult(BaseModel):
    text: str
    language: str
    words: List[WordTimestamp]
    filler_cut_points: List[CutPoint]
    filler_words_found: List[str]
    confidence: float


class BeatSyncResult(BaseModel):
    bpm: float
    beat_timestamps: List[float]
    total_beats: int
    beat_confidence: float


class SceneDetectResult(BaseModel):
    scenes: List[Scene]
    total_scenes: int
    avg_scene_duration: float


class ColorSettings(BaseModel):
    brightness: float
    contrast: float
    saturation: float
    temperature: float
    tint: float
    lut_suggestion: str


class AudioSettings(BaseModel):
    current_lufs: float
    target_lufs: float
    gain_db: float
    denoise_suggested: bool


class AutoColorResult(BaseModel):
    color_settings: ColorSettings
    audio_settings: AudioSettings
    histogram_data: Dict[str, List[float]]


# ── AutoCaptions ───────────────────────────────────────────────────────────────

class CaptionWord(BaseModel):
    word: str
    start: float
    end: float


class Caption(BaseModel):
    index: int
    start: float
    end: float
    text: str
    words: List[CaptionWord]


class AutoCaptionsResult(BaseModel):
    captions: List[Caption]
    total_captions: int
    srt_content: str
    style: str
    language: str


# ── AutoZoom ───────────────────────────────────────────────────────────────────

class ZoomKeyframe(BaseModel):
    time: float
    scale: float        # 1.0 = no zoom, 1.3 = 30% zoom in
    center_x: float     # 0.0–1.0, 0.5 = center
    center_y: float
    duration: float     # transition duration in seconds


class AutoZoomResult(BaseModel):
    keyframes: List[ZoomKeyframe]
    total_zooms: int
    avg_scale: float


# ── ViralDetect ────────────────────────────────────────────────────────────────

class ViralSegment(BaseModel):
    start: float
    end: float
    duration: float
    score: float        # 0.0–1.0
    reason: str         # "high_energy", "topic_peak", "scene_density"
    thumbnail_time: float


class ViralDetectResult(BaseModel):
    segments: List[ViralSegment]
    best_segment: Optional[ViralSegment]
    total_candidates: int


# ── PodcastMode ────────────────────────────────────────────────────────────────

class SpeakerSegment(BaseModel):
    speaker_id: str     # "SPEAKER_1", "SPEAKER_2", etc.
    start: float
    end: float
    duration: float
    channel: int        # 0=left, 1=right, -1=mono/unknown


class PodcastResult(BaseModel):
    segments: List[SpeakerSegment]
    total_speakers: int
    speaker_durations: Dict[str, float]
    cut_points: List[CutPoint]


# ── RepeatDetect ───────────────────────────────────────────────────────────────

class RepeatSegment(BaseModel):
    start: float
    end: float
    text: str
    rms_score: float    # audio quality (higher = louder/clearer)
    is_best_take: bool


class RepeatGroup(BaseModel):
    group_id: int
    segments: List[RepeatSegment]
    best_take: RepeatSegment


class RepeatDetectResult(BaseModel):
    groups: List[RepeatGroup]
    total_groups: int
    cuts_suggested: List[CutPoint]
    time_saved: float


# ── ProfanityFilter ────────────────────────────────────────────────────────────

class BleepPoint(BaseModel):
    start: float
    end: float
    word: str
    replacement: str    # "bleep" | "mute" | "beep"


class ProfanityResult(BaseModel):
    bleep_points: List[BleepPoint]
    total_found: int
    words_found: List[str]
    clean_transcript: str


# ── AutoChapters ───────────────────────────────────────────────────────────────

class Chapter(BaseModel):
    index: int
    title: str
    start: float
    end: float
    duration: float
    keywords: List[str]


class AutoChaptersResult(BaseModel):
    chapters: List[Chapter]
    total_chapters: int
    youtube_format: str     # "0:00 Giriş\n1:23 Konu 1..."
    description_block: str  # ready-to-paste YouTube description


# ── AutoResize ─────────────────────────────────────────────────────────────────

class ResizeFormat(BaseModel):
    name: str               # "9:16 (TikTok/Reels)", "1:1 (Instagram)", "4:5"
    ratio_w: int
    ratio_h: int
    crop_x: float           # 0.0–1.0 relative to original width
    crop_y: float
    crop_width: float
    crop_height: float
    scale: float


class AutoResizeResult(BaseModel):
    original_resolution: str
    formats: List[ResizeFormat]
    subject_detected: bool
    subject_center_x: float
    subject_center_y: float


# ── BRollSuggest ───────────────────────────────────────────────────────────────

class BRollSuggestion(BaseModel):
    start: float
    end: float
    duration: float
    keyword: str
    search_query: str
    type: str               # "explanation", "transition", "emphasis", "intro"
    priority: float         # 0.0–1.0


class BRollResult(BaseModel):
    suggestions: List[BRollSuggestion]
    total_suggestions: int
    total_broll_duration: float


# ── MemeFinder ─────────────────────────────────────────────────────────────────

class MemeSuggestion(BaseModel):
    source: str             # "generated" | "imgflip" | "tenor" | "giphy"
    title: str              # template/meme name or caption
    url: Optional[str] = None       # remote image/gif URL (api sources)
    local_path: Optional[str] = None  # generated file on disk
    media_type: str = "image"       # "image" | "gif"
    query: str = ""                  # the search term / topic that matched
    top_text: str = ""               # for generated memes
    bottom_text: str = ""
    keywords: List[str] = []
    language: str = "tr"             # "tr" | "en"
    score: float = 0.5               # relevance 0.0–1.0
    placement: Optional[float] = None  # suggested video timestamp (auto mode)


class MemeResult(BaseModel):
    suggestions: List[MemeSuggestion]
    total: int
    mode: str               # "text" | "transcript"
    sources_used: List[str]
