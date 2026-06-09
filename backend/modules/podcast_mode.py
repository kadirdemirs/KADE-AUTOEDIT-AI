import asyncio
from typing import Callable, Dict, List, Optional

from models.result import CutPoint, PodcastResult, SpeakerSegment
from utils.ffmpeg_utils import extract_audio


async def detect_speakers(
    video_path: str,
    min_segment_duration: float = 1.0,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> PodcastResult:
    if progress_callback:
        await progress_callback(0.1, "Extracting audio channels...")

    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.3, "Detecting speakers...")

    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _diarize(audio_path, min_segment_duration)
    )

    if progress_callback:
        await progress_callback(1.0, "Speaker detection done.")

    return result


def _diarize(audio_path: str, min_seg: float) -> PodcastResult:
    """
    Energy-based speaker diarization.
    - Stereo: left channel = SPEAKER_1, right = SPEAKER_2
    - Mono: cluster by short-term energy variance (2 speakers assumed)
    """
    import numpy as np
    import soundfile as sf
    from scipy.ndimage import uniform_filter1d

    data, sr = sf.read(audio_path, always_2d=True)
    n_channels = data.shape[1] if data.ndim > 1 else 1

    window_samples = int(sr * 0.1)    # 100ms
    hop_samples = window_samples // 2

    if n_channels >= 2:
        # Stereo: separate channels as speakers
        left  = data[:, 0]
        right = data[:, 1]
        segments = _stereo_diarize(left, right, sr, window_samples, hop_samples, min_seg)
    else:
        mono = data[:, 0] if data.ndim > 1 else data
        segments = _mono_diarize(mono, sr, window_samples, hop_samples, min_seg)

    speaker_durations: Dict[str, float] = {}
    for s in segments:
        speaker_durations[s.speaker_id] = round(
            speaker_durations.get(s.speaker_id, 0.0) + s.duration, 3
        )

    # Camera cut points: each speaker change = potential cut
    cut_points = []
    for i in range(1, len(segments)):
        if segments[i].speaker_id != segments[i - 1].speaker_id:
            cut_points.append(CutPoint(
                start=segments[i].start,
                end=segments[i].start + 0.04,
                type="cut",
                label=f"→ {segments[i].speaker_id}",
            ))

    return PodcastResult(
        segments=segments,
        total_speakers=len(speaker_durations),
        speaker_durations=speaker_durations,
        cut_points=cut_points,
    )


def _rms_track(data: "np.ndarray", window: int, hop: int) -> "tuple[np.ndarray, np.ndarray]":
    import numpy as np
    rms_list, times = [], []
    for i in range(0, len(data) - window, hop):
        chunk = data[i: i + window]
        rms = float(np.sqrt(np.mean(chunk.astype(np.float64) ** 2)))
        rms_list.append(rms)
        times.append(i / len(data))  # will be overridden
    return np.array(rms_list), np.arange(len(rms_list)) * hop


def _stereo_diarize(
    left: "np.ndarray", right: "np.ndarray",
    sr: int, window: int, hop: int, min_seg: float
) -> List[SpeakerSegment]:
    import numpy as np
    from scipy.ndimage import uniform_filter1d

    rms_l, rms_r = [], []
    for i in range(0, min(len(left), len(right)) - window, hop):
        cl = left[i: i + window].astype(np.float64)
        cr = right[i: i + window].astype(np.float64)
        rms_l.append(np.sqrt(np.mean(cl ** 2)))
        rms_r.append(np.sqrt(np.mean(cr ** 2)))

    rms_l = uniform_filter1d(np.array(rms_l), size=5)
    rms_r = uniform_filter1d(np.array(rms_r), size=5)

    assignments = []
    for l_val, r_val in zip(rms_l, rms_r):
        if l_val > r_val * 1.3:
            assignments.append("SPEAKER_1")
        elif r_val > l_val * 1.3:
            assignments.append("SPEAKER_2")
        else:
            assignments.append(assignments[-1] if assignments else "SPEAKER_1")

    return _assignments_to_segments(assignments, hop, sr, min_seg)


def _mono_diarize(
    mono: "np.ndarray", sr: int, window: int, hop: int, min_seg: float
) -> List[SpeakerSegment]:
    """
    Simple mono diarization: use energy + zero-crossing rate to cluster 2 speakers.
    """
    import numpy as np
    from scipy.ndimage import uniform_filter1d

    features = []
    for i in range(0, len(mono) - window, hop):
        chunk = mono[i: i + window].astype(np.float64)
        rms = np.sqrt(np.mean(chunk ** 2))
        zcr = np.mean(np.abs(np.diff(np.sign(chunk)))) / 2
        features.append([rms, zcr])

    if len(features) < 4:
        return []

    feat_arr = np.array(features)
    # Normalize
    feat_max = feat_arr.max(axis=0) + 1e-9
    feat_norm = feat_arr / feat_max

    # Simple k-means with k=2 when sklearn is available.
    try:
        from sklearn.cluster import KMeans
        labels = KMeans(n_clusters=2, n_init=5, random_state=0).fit_predict(feat_norm)
    except Exception:
        labels = (feat_norm[:, 0] > feat_norm[:, 0].mean()).astype(int)

    assignments = [f"SPEAKER_{l + 1}" for l in labels]
    return _assignments_to_segments(assignments, hop, sr, min_seg)


def _assignments_to_segments(
    assignments: List[str], hop: int, sr: int, min_seg: float
) -> List[SpeakerSegment]:
    if not assignments:
        return []

    segments: List[SpeakerSegment] = []
    current = assignments[0]
    seg_start_idx = 0

    for i in range(1, len(assignments)):
        if assignments[i] != current:
            start_t = seg_start_idx * hop / sr
            end_t = i * hop / sr
            dur = end_t - start_t
            if dur >= min_seg:
                segments.append(SpeakerSegment(
                    speaker_id=current,
                    start=round(start_t, 3),
                    end=round(end_t, 3),
                    duration=round(dur, 3),
                    channel=-1,
                ))
            current = assignments[i]
            seg_start_idx = i

    # Last segment
    start_t = seg_start_idx * hop / sr
    end_t = len(assignments) * hop / sr
    dur = end_t - start_t
    if dur >= min_seg:
        segments.append(SpeakerSegment(
            speaker_id=current,
            start=round(start_t, 3),
            end=round(end_t, 3),
            duration=round(dur, 3),
            channel=-1,
        ))

    return segments
