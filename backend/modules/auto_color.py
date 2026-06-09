import asyncio
from typing import Callable, Dict, List, Optional

from config import settings
from models.result import AudioSettings, AutoColorResult, ColorSettings


async def analyze_color_audio(
    video_path: str,
    target_lufs: float = None,
    lut_intensity: float = 1.0,
    denoise: bool = False,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> AutoColorResult:
    target_lufs = target_lufs if target_lufs is not None else settings.TARGET_LUFS

    if progress_callback:
        await progress_callback(0.1, "Extracting video frame for analysis...")

    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _analyze(video_path, target_lufs, lut_intensity, denoise)
    )

    if progress_callback:
        await progress_callback(1.0, "Color/audio analysis complete.")

    return result


def _analyze(
    video_path: str,
    target_lufs: float,
    lut_intensity: float,
    denoise: bool,
) -> AutoColorResult:
    import cv2
    import numpy as np
    import pyloudnorm as pyln
    import soundfile as sf
    from utils.ffmpeg_utils import extract_audio

    # --- Video analysis ---
    cap = cv2.VideoCapture(str(video_path))
    frames_to_sample = 10
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, frame_count // frames_to_sample)

    hist_r, hist_g, hist_b = (np.zeros(256) for _ in range(3))
    samples = 0

    for i in range(0, min(frame_count, frames_to_sample * step), step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            break
        b, g, r = cv2.split(frame)
        hist_r += cv2.calcHist([r], [0], None, [256], [0, 256]).flatten()
        hist_g += cv2.calcHist([g], [0], None, [256], [0, 256]).flatten()
        hist_b += cv2.calcHist([b], [0], None, [256], [0, 256]).flatten()
        samples += 1

    cap.release()

    if samples > 0:
        hist_r /= samples
        hist_g /= samples
        hist_b /= samples

    # Normalize histograms
    hist_data = {
        "r": (hist_r / (hist_r.sum() + 1e-6)).tolist(),
        "g": (hist_g / (hist_g.sum() + 1e-6)).tolist(),
        "b": (hist_b / (hist_b.sum() + 1e-6)).tolist(),
    }

    # Compute color statistics
    r_mean = float(np.average(np.arange(256), weights=hist_data["r"] or [1/256]*256))
    g_mean = float(np.average(np.arange(256), weights=hist_data["g"] or [1/256]*256))
    b_mean = float(np.average(np.arange(256), weights=hist_data["b"] or [1/256]*256))

    brightness = round((r_mean + g_mean + b_mean) / 3.0 / 255.0 * 100, 1)
    contrast = round(float(np.std([r_mean, g_mean, b_mean])), 1)
    temperature = round(r_mean - b_mean, 1)
    tint = round(g_mean - (r_mean + b_mean) / 2.0, 1)
    saturation = round(contrast * 2, 1)

    # LUT suggestion based on color temperature
    if temperature > 10:
        lut_suggestion = "cool_correction"
    elif temperature < -10:
        lut_suggestion = "warm_correction"
    else:
        lut_suggestion = "neutral"

    color_settings = ColorSettings(
        brightness=brightness,
        contrast=contrast,
        saturation=saturation,
        temperature=temperature,
        tint=tint,
        lut_suggestion=lut_suggestion,
    )

    # --- Audio analysis ---
    audio_path = extract_audio(video_path)
    try:
        data, rate = sf.read(audio_path)
        meter = pyln.Meter(rate)
        current_lufs = float(meter.integrated_loudness(data))
    except Exception:
        current_lufs = -23.0

    gain_db = round(target_lufs - current_lufs, 2)

    # Suggest denoising if very quiet or noisy signal
    denoise_suggested = denoise or (current_lufs < -30)

    audio_settings = AudioSettings(
        current_lufs=round(current_lufs, 2),
        target_lufs=target_lufs,
        gain_db=gain_db,
        denoise_suggested=denoise_suggested,
    )

    return AutoColorResult(
        color_settings=color_settings,
        audio_settings=audio_settings,
        histogram_data=hist_data,
    )
