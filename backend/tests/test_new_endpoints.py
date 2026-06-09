import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import main


def _upload(client: TestClient, path: str, data: dict | None = None):
    return client.post(
        path,
        files={"file": ("sample.mp4", b"fake media bytes", "video/mp4")},
        data=data or {},
    )


def _assert_job_response(response, expected: dict):
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["job_id"]
    assert payload["result"] == expected


def test_auto_captions_endpoint(monkeypatch):
    expected = {"total_captions": 1, "style": "youtube", "language": "tr"}

    async def fake_generate_captions(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "generate_captions", fake_generate_captions)
    with TestClient(main.app) as client:
        response = _upload(client, "/auto-captions", {"style": "youtube"})

    _assert_job_response(response, expected)


def test_auto_zoom_endpoint(monkeypatch):
    expected = {"total_zooms": 2, "avg_scale": 1.25}

    async def fake_detect_zoom_points(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "detect_zoom_points", fake_detect_zoom_points)
    with TestClient(main.app) as client:
        response = _upload(client, "/auto-zoom", {"min_scale": "1.1", "max_scale": "1.4"})

    _assert_job_response(response, expected)


def test_viral_detect_endpoint(monkeypatch):
    expected = {"total_candidates": 1, "segments": [{"start": 0, "end": 30}]}

    async def fake_detect_viral_segments(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "detect_viral_segments", fake_detect_viral_segments)
    with TestClient(main.app) as client:
        response = _upload(client, "/viral-detect", {"clip_duration": "30", "top_n": "1"})

    _assert_job_response(response, expected)


def test_podcast_mode_endpoint(monkeypatch):
    expected = {"total_speakers": 2, "segments": [], "cut_points": []}

    async def fake_detect_speakers(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "detect_speakers", fake_detect_speakers)
    with TestClient(main.app) as client:
        response = _upload(client, "/podcast-mode", {"min_segment_duration": "1.5"})

    _assert_job_response(response, expected)


def test_repeat_detect_endpoint(monkeypatch):
    expected = {"total_groups": 1, "cuts_suggested": [], "time_saved": 2.0}

    async def fake_detect_repeats(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "detect_repeats", fake_detect_repeats)
    with TestClient(main.app) as client:
        response = _upload(client, "/repeat-detect", {"similarity_threshold": "0.7"})

    _assert_job_response(response, expected)


def test_profanity_filter_endpoint(monkeypatch):
    expected = {"total_found": 1, "words_found": ["test"], "clean_transcript": "[*]"}

    async def fake_filter_profanity(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "filter_profanity", fake_filter_profanity)
    with TestClient(main.app) as client:
        response = _upload(client, "/profanity-filter", {"replacement": "mute"})

    _assert_job_response(response, expected)


def test_auto_chapters_endpoint(monkeypatch):
    expected = {"total_chapters": 1, "youtube_format": "0:00 Intro", "description_block": "0:00 Intro"}

    async def fake_generate_chapters(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "generate_chapters", fake_generate_chapters)
    with TestClient(main.app) as client:
        response = _upload(client, "/auto-chapters", {"max_chapters": "4"})

    _assert_job_response(response, expected)


def test_auto_resize_endpoint(monkeypatch):
    expected = {"original_resolution": "1920x1080", "formats": [], "subject_detected": False}

    async def fake_analyze_resize(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "analyze_resize", fake_analyze_resize)
    with TestClient(main.app) as client:
        response = _upload(client, "/auto-resize")

    _assert_job_response(response, expected)


def test_broll_suggest_endpoint(monkeypatch):
    expected = {"total_suggestions": 1, "total_broll_duration": 3.0, "suggestions": []}

    async def fake_suggest_broll(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "suggest_broll", fake_suggest_broll)
    with TestClient(main.app) as client:
        response = _upload(client, "/broll-suggest", {"max_suggestions": "5"})

    _assert_job_response(response, expected)
