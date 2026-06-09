import asyncio
from typing import List, Dict, Callable, Optional

from config import settings
from models.result import CutPoint, SilenceCutResult
from utils.audio_utils import detect_silence_ranges
from utils.ffmpeg_utils import extract_audio


async def cut_silences(
    video_path: str,
    threshold_db: float = None,
    min_silence_ms: int = None,
    fade_ms: int = None,
    keep_padding_ms: int = None,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> SilenceCutResult:
    threshold_db = threshold_db if threshold_db is not None else settings.SILENCE_THRESHOLD
    min_silence_ms = min_silence_ms if min_silence_ms is not None else int(settings.MIN_SILENCE_DURATION * 1000)
    fade_ms = fade_ms if fade_ms is not None else int(settings.FADE_DURATION * 1000)
    keep_padding_ms = keep_padding_ms if keep_padding_ms is not None else settings.KEEP_PADDING_MS

    if progress_callback:
        await progress_callback(0.1, "Extracting audio...")

    # Run blocking I/O in thread pool
    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.3, "Analyzing silence ranges...")

    silence_ranges = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: detect_silence_ranges(audio_path, threshold_db, min_silence_ms)
    )

    if progress_callback:
        await progress_callback(0.7, "Building cut points...")

    cut_points = _build_cut_points(silence_ranges, keep_padding_ms, fade_ms)

    total_silence = sum(end - start for start, end in silence_ranges)
    total_cut_duration = sum(
        cp.end - cp.start for cp in cut_points if cp.type == "cut"
    )

    # Estimate kept duration (rough)
    from utils.ffmpeg_utils import get_video_info
    info = await asyncio.get_event_loop().run_in_executor(None, get_video_info, video_path)
    total_kept = info["duration"] - total_cut_duration

    if progress_callback:
        await progress_callback(1.0, "Done.")

    return SilenceCutResult(
        cut_points=cut_points,
        total_silence_duration=round(total_silence, 3),
        total_kept_duration=round(max(0, total_kept), 3),
        cuts_count=len([cp for cp in cut_points if cp.type == "cut"]),
    )


def _build_cut_points(
    silence_ranges: List,
    keep_padding_ms: int,
    fade_ms: int,
) -> List[CutPoint]:
    """Convert silence ranges to cut points with padding and J/L-cut support."""
    padding_sec = keep_padding_ms / 1000.0
    cut_points = []

    for start, end in silence_ranges:
        # Shrink silence by padding on both sides (keep a bit of audio around speech)
        cut_start = start + padding_sec
        cut_end = end - padding_sec

        if cut_end <= cut_start:
            continue

        duration = cut_end - cut_start

        # Classify cut type based on duration
        if duration < 0.3:
            cut_type = "j-cut"  # Short: use J-cut (keep audio overlap)
        elif duration < 1.0:
            cut_type = "cut"
        else:
            cut_type = "l-cut"  # Long: use L-cut (extend audio from previous)

        cut_points.append(CutPoint(
            start=round(cut_start, 3),
            end=round(cut_end, 3),
            type=cut_type,
            label=f"silence_{round(duration, 1)}s",
            confidence=1.0,
        ))

    return cut_points
