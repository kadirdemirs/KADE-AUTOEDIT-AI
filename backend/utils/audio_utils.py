import numpy as np
import soundfile as sf
from typing import List, Tuple, Dict


def compute_rms(samples: np.ndarray) -> float:
    """Return RMS in dBFS for a float32 sample array (range -1.0..1.0)."""
    if len(samples) == 0:
        return -100.0
    rms = np.sqrt(np.mean(samples.astype(np.float64) ** 2))
    if rms == 0:
        return -100.0
    return float(20 * np.log10(rms))


def analyze_audio_levels(audio_path: str, chunk_ms: int = 100) -> List[Dict]:
    """Return list of {time_ms, rms_db} for each chunk."""
    data, sr = sf.read(audio_path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)  # mix to mono

    chunk_samples = int(sr * chunk_ms / 1000)
    results = []
    for i in range(0, len(data), chunk_samples):
        chunk = data[i: i + chunk_samples]
        rms_db = compute_rms(chunk)
        results.append({"time_ms": int(i * 1000 / sr), "rms_db": rms_db})
    return results


def detect_silence_ranges(
    audio_path: str,
    threshold_db: float = -40.0,
    min_silence_ms: int = 500,
    chunk_ms: int = 50,
) -> List[Tuple[float, float]]:
    """Return list of (start_sec, end_sec) for silence regions."""
    data, sr = sf.read(audio_path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)

    chunk_samples = int(sr * chunk_ms / 1000)
    min_silence_chunks = max(1, min_silence_ms // chunk_ms)

    silence_ranges = []
    silence_start = None
    silence_count = 0

    for i in range(0, len(data), chunk_samples):
        chunk = data[i: i + chunk_samples]
        rms_db = compute_rms(chunk)
        time_sec = i / sr

        if rms_db < threshold_db:
            if silence_start is None:
                silence_start = time_sec
            silence_count += 1
        else:
            if silence_start is not None:
                if silence_count >= min_silence_chunks:
                    silence_end = time_sec
                    silence_ranges.append((silence_start, silence_end))
                silence_start = None
                silence_count = 0

    # Handle trailing silence
    if silence_start is not None and silence_count >= min_silence_chunks:
        silence_ranges.append((silence_start, len(data) / sr))

    return silence_ranges
