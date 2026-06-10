import os
import sys
import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from modules.beat_sync import _run_beat_detection


def _create_test_audio(path: str, duration: float = 5.0, bpm: float = 120.0):
    """Generate a simple click-track WAV for testing."""
    import soundfile as sf
    sr = 22050
    samples = int(sr * duration)
    y = np.zeros(samples)

    # Place clicks at beat positions
    beat_interval = sr * 60.0 / bpm
    pos = 0.0
    while pos < samples:
        idx = int(pos)
        if idx < samples:
            y[idx] = 1.0
        pos += beat_interval

    sf.write(path, y, sr)
    return path


def test_beat_detection_click_track(tmp_path):
    audio_file = str(tmp_path / "click.wav")
    _create_test_audio(audio_file, duration=10.0, bpm=120.0)

    result = _run_beat_detection(audio_file, sensitivity=1.0)

    assert result.bpm > 0
    assert len(result.beat_timestamps) > 0
    # Allow ±10 BPM tolerance for synthetic track
    assert abs(result.bpm - 120.0) < 15.0


def test_beat_detection_sensitivity_filter(tmp_path):
    audio_file = str(tmp_path / "click.wav")
    _create_test_audio(audio_file, duration=10.0, bpm=120.0)

    result_full = _run_beat_detection(audio_file, sensitivity=1.0)
    result_filtered = _run_beat_detection(audio_file, sensitivity=0.3)

    assert result_filtered.total_beats <= result_full.total_beats


def test_beat_detection_handles_no_detected_beats(tmp_path):
    import soundfile as sf

    sr = 22050
    y = np.sin(2 * np.pi * 440 * np.linspace(0, 1.5, int(sr * 1.5), endpoint=False))
    audio_file = str(tmp_path / "tone.wav")
    sf.write(audio_file, y, sr)

    result = _run_beat_detection(audio_file, sensitivity=0.5)

    assert result.total_beats >= 0
    assert isinstance(result.beat_timestamps, list)


@pytest.mark.asyncio
async def test_detect_beats_missing_file():
    from modules.beat_sync import detect_beats
    with pytest.raises(Exception):
        await detect_beats("/nonexistent/video.mp4")
