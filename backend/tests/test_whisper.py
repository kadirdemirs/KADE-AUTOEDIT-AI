import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from modules.whisper_transcript import _process_words, _compute_confidence


def _make_segment(words_data):
    return {"segments": [{"words": words_data, "avg_logprob": -0.3}]}


def test_filler_detection():
    result = _make_segment([
        {"word": "ee", "start": 0.0, "end": 0.2},
        {"word": "merhaba", "start": 0.3, "end": 0.8},
        {"word": "şey", "start": 1.0, "end": 1.2},
    ])
    from config import settings
    words, cut_points, fillers = _process_words(result, settings.FILLER_WORDS, True)

    filler_words = [w.word for w in words if w.is_filler]
    assert "ee" in filler_words
    assert "şey" in filler_words
    assert "merhaba" not in filler_words
    assert len(cut_points) == 2


def test_no_filler_detection_when_disabled():
    result = _make_segment([
        {"word": "um", "start": 0.0, "end": 0.2},
        {"word": "hello", "start": 0.3, "end": 0.8},
    ])
    from config import settings
    words, cut_points, fillers = _process_words(result, settings.FILLER_WORDS, False)

    assert len(cut_points) == 0
    assert all(not w.is_filler for w in words)


def test_confidence_computation():
    result = {"segments": [{"avg_logprob": -0.2}, {"avg_logprob": -0.3}]}
    conf = _compute_confidence(result)
    assert 0.0 <= conf <= 1.0


def test_empty_segments():
    result = {"segments": []}
    words, cut_points, fillers = _process_words(result, [], True)
    assert words == []
    assert cut_points == []
    assert fillers == []
    assert _compute_confidence(result) == 0.0


@pytest.mark.asyncio
async def test_transcribe_missing_file():
    from modules.whisper_transcript import transcribe_audio
    with pytest.raises(Exception):
        await transcribe_audio("/nonexistent/file.mp4")
