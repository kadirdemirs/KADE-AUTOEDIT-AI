"""Smoke tests for the `*-path` timeline endpoints.

These mirror the upload endpoints in test_new_endpoints.py but send a
`source_path` (the media file already on the Premiere timeline) instead of an
upload. `_resolve_media_path` is patched so the tests don't need ffmpeg or a
real file on disk — we only verify the endpoint wires `source_path`,
`source_start`/`source_end` and the module result through the job pipeline.
"""

import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import main


def _post_path(client: TestClient, path: str, data: dict | None = None):
    body = {"source_path": "C:/fake/clip.mp4"}
    body.update(data or {})
    return client.post(path, data=body)


def _assert_job_response(response, expected: dict):
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["job_id"]
    assert payload["result"] == expected


def test_silence_cut_path_endpoint(monkeypatch):
    expected = {"cuts_count": 3, "total_silence_duration": 4.2, "total_kept_duration": 10.0, "cut_points": []}

    # Patch the slicer so no ffmpeg / real file is needed; assert it received the path + in/out.
    seen = {}

    def fake_resolve(source_path, source_start, source_end):
        seen["source_path"] = source_path
        seen["source_start"] = source_start
        seen["source_end"] = source_end
        return source_path

    async def fake_cut_silences(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "_resolve_media_path", fake_resolve)
    monkeypatch.setattr(main, "cut_silences", fake_cut_silences)
    with TestClient(main.app) as client:
        response = _post_path(client, "/silence-cut-path", {"source_start": "5", "source_end": "12"})

    _assert_job_response(response, expected)
    assert seen["source_path"] == "C:/fake/clip.mp4"
    assert seen["source_start"] == 5.0
    assert seen["source_end"] == 12.0


def test_auto_zoom_path_endpoint(monkeypatch):
    expected = {"total_zooms": 2, "avg_scale": 1.25}

    monkeypatch.setattr(main, "_resolve_media_path", lambda p, s, e: p)

    async def fake_detect_zoom_points(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "detect_zoom_points", fake_detect_zoom_points)
    with TestClient(main.app) as client:
        response = _post_path(client, "/auto-zoom-path", {"min_scale": "1.1", "max_scale": "1.4"})

    _assert_job_response(response, expected)


def test_auto_captions_path_endpoint(monkeypatch):
    expected = {"total_captions": 1, "style": "youtube", "language": "tr"}

    monkeypatch.setattr(main, "_resolve_media_path", lambda p, s, e: p)

    async def fake_generate_captions(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "generate_captions", fake_generate_captions)
    with TestClient(main.app) as client:
        response = _post_path(client, "/auto-captions-path", {"style": "youtube"})

    _assert_job_response(response, expected)


def test_meme_find_path_endpoint(monkeypatch):
    expected = {"total": 2, "mode": "video", "sources_used": ["generated"], "suggestions": []}

    monkeypatch.setattr(main, "_resolve_media_path", lambda p, s, e: p)

    async def fake_find_memes(*args, **kwargs):
        await kwargs["progress_callback"](1.0, "done")
        return expected

    monkeypatch.setattr(main, "find_memes", fake_find_memes)
    with TestClient(main.app) as client:
        response = _post_path(client, "/meme-find-path", {"sources": "generated"})

    _assert_job_response(response, expected)
