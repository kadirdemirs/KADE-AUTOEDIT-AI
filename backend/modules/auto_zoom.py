import asyncio
from typing import Callable, List, Optional

from config import settings
from models.result import AutoZoomResult, ZoomKeyframe
from utils.ffmpeg_utils import extract_audio


async def detect_zoom_points(
    video_path: str,
    min_scale: float = 1.15,
    max_scale: float = 1.40,
    sensitivity: float = 0.7,
    zoom_duration: float = 0.3,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> AutoZoomResult:
    if progress_callback:
        await progress_callback(0.1, "Extracting audio...")

    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.3, "Analyzing energy peaks...")

    keyframes = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _find_zoom_keyframes(audio_path, min_scale, max_scale, sensitivity, zoom_duration)
    )

    if progress_callback:
        await progress_callback(1.0, "Zoom keyframes ready.")

    avg_scale = sum(k.scale for k in keyframes) / len(keyframes) if keyframes else 1.0

    return AutoZoomResult(
        keyframes=keyframes,
        total_zooms=len(keyframes),
        avg_scale=round(avg_scale, 3),
    )


def _find_zoom_keyframes(
    audio_path: str,
    min_scale: float,
    max_scale: float,
    sensitivity: float,
    zoom_duration: float,
) -> List[ZoomKeyframe]:
    import numpy as np
    import soundfile as sf
    from scipy.signal import find_peaks

    data, sr = sf.read(audio_path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)

    # Compute RMS in 100ms windows
    window = int(sr * 0.1)
    hop = window // 2
    rms_vals = []
    times = []
    for i in range(0, len(data) - window, hop):
        chunk = data[i: i + window]
        rms = float(np.sqrt(np.mean(chunk.astype(np.float64) ** 2)))
        rms_vals.append(rms)
        times.append(i / sr)

    rms_arr = np.array(rms_vals)
    if rms_arr.max() == 0:
        return []

    rms_norm = rms_arr / rms_arr.max()

    # Find prominent peaks — prominence controls sensitivity
    prominence = 1.0 - sensitivity
    peaks, props = find_peaks(
        rms_norm,
        height=0.3 + prominence * 0.4,
        distance=int(1.5 / (hop / sr)),   # min 1.5s between zooms
        prominence=prominence * 0.2,
    )

    keyframes: List[ZoomKeyframe] = []
    for p in peaks:
        t = times[p]
        # Scale proportional to peak energy
        energy_ratio = float(rms_norm[p])
        scale = min_scale + (max_scale - min_scale) * energy_ratio
        keyframes.append(ZoomKeyframe(
            time=round(t, 3),
            scale=round(scale, 3),
            center_x=0.5,
            center_y=0.5,
            duration=zoom_duration,
        ))

    return keyframes
