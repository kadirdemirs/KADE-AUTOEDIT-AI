import asyncio
from typing import Callable, Optional

from config import settings
from models.result import BeatSyncResult
from utils.ffmpeg_utils import extract_audio


async def detect_beats(
    video_path: str,
    sensitivity: float = None,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> BeatSyncResult:
    sensitivity = sensitivity if sensitivity is not None else settings.BEAT_SENSITIVITY

    if progress_callback:
        await progress_callback(0.1, "Extracting audio for beat detection...")

    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.3, "Detecting beats...")

    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _run_beat_detection(audio_path, sensitivity)
    )

    if progress_callback:
        await progress_callback(1.0, "Beat detection complete.")

    return result


def _run_beat_detection(audio_path: str, sensitivity: float) -> BeatSyncResult:
    import librosa
    import numpy as np

    y, sr = librosa.load(audio_path, sr=None, mono=True)

    # Detect tempo and beat frames
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")

    # Apply sensitivity filter — higher sensitivity = keep more beats
    if sensitivity < 1.0:
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)

        # Score each beat by onset strength
        beat_strengths = onset_env[beat_frames]
        threshold = np.percentile(beat_strengths, (1.0 - sensitivity) * 100)
        mask = beat_strengths >= threshold
        beat_frames = beat_frames[mask]

    beat_timestamps = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # Confidence: use autocorrelation-based beat strength estimate
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    ac = librosa.autocorrelate(onset_env)
    beat_confidence = float(min(1.0, ac.max() / (ac[0] + 1e-6)))

    scalar_tempo = float(np.atleast_1d(tempo)[0])

    return BeatSyncResult(
        bpm=round(scalar_tempo, 2),
        beat_timestamps=[round(t, 3) for t in beat_timestamps],
        total_beats=len(beat_timestamps),
        beat_confidence=round(beat_confidence, 3),
    )
