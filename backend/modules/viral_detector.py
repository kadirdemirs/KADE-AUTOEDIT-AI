import asyncio
from typing import Callable, List, Optional

from models.result import ViralDetectResult, ViralSegment
from utils.ffmpeg_utils import extract_audio, get_video_info


async def detect_viral_segments(
    video_path: str,
    clip_duration: float = 60.0,
    top_n: int = 3,
    min_duration: float = 20.0,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> ViralDetectResult:
    if progress_callback:
        await progress_callback(0.05, "Getting video info...")

    info = await asyncio.get_event_loop().run_in_executor(
        None, get_video_info, video_path
    )
    total_duration = info["duration"]

    if progress_callback:
        await progress_callback(0.15, "Extracting audio...")

    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.35, "Scoring segments...")

    segments = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _score_segments(audio_path, total_duration, clip_duration, min_duration, top_n)
    )

    if progress_callback:
        await progress_callback(1.0, "Viral segments found.")

    best = segments[0] if segments else None
    return ViralDetectResult(
        segments=segments,
        best_segment=best,
        total_candidates=len(segments),
    )


def _score_segments(
    audio_path: str,
    total_duration: float,
    clip_duration: float,
    min_duration: float,
    top_n: int,
) -> List[ViralSegment]:
    import numpy as np
    import soundfile as sf

    data, sr = sf.read(audio_path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)

    # Build energy timeline in 1s windows
    window = sr
    energies = []
    for i in range(0, len(data) - window, window):
        chunk = data[i: i + window]
        rms = float(np.sqrt(np.mean(chunk.astype(np.float64) ** 2)))
        energies.append(rms)

    if not energies:
        return []

    energies_arr = np.array(energies)
    max_e = energies_arr.max() or 1e-6
    norm = energies_arr / max_e

    # Sliding window over clip_duration seconds
    win_sec = min(int(clip_duration), len(energies))
    scores: List[tuple] = []

    for start_sec in range(0, len(energies) - win_sec + 1, max(1, win_sec // 10)):
        window_e = norm[start_sec: start_sec + win_sec]

        # Score = mean energy + variance boost (dynamic content) + density of peaks
        mean_e = float(window_e.mean())
        var_e = float(window_e.var())

        # Count local peaks in window
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(window_e, height=0.3, distance=3)
        peak_density = len(peaks) / win_sec

        score = 0.5 * mean_e + 0.3 * min(var_e * 10, 1.0) + 0.2 * min(peak_density * 5, 1.0)

        start_time = float(start_sec)
        end_time = min(start_time + clip_duration, total_duration)

        # Classify reason
        if mean_e > 0.6:
            reason = "high_energy"
        elif var_e > 0.05:
            reason = "scene_density"
        else:
            reason = "topic_peak"

        scores.append((score, start_time, end_time, reason))

    # Sort by score descending, pick top_n non-overlapping
    scores.sort(key=lambda x: x[0], reverse=True)
    selected: List[ViralSegment] = []

    for score, start, end, reason in scores:
        if end - start < min_duration:
            continue
        # Avoid overlaps
        overlap = any(
            not (end <= s.start or start >= s.end)
            for s in selected
        )
        if overlap:
            continue
        selected.append(ViralSegment(
            start=round(start, 2),
            end=round(end, 2),
            duration=round(end - start, 2),
            score=round(float(score), 4),
            reason=reason,
            thumbnail_time=round(start + (end - start) * 0.3, 2),
        ))
        if len(selected) >= top_n:
            break

    return selected
