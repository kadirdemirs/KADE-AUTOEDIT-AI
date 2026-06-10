import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from modules import meme_finder
from modules.meme_finder import (
    _keywords, _looks_turkish, _split_caption, find_memes,
)


def test_looks_turkish():
    assert _looks_turkish("pazartesi sendromu çok kötü")
    assert _looks_turkish("bu bir test için")
    assert not _looks_turkish("monday blues are real")


def test_keywords_strips_stopwords():
    kws = _keywords("bu bir çok önemli deadline stresi", n=3)
    assert "deadline" in kws or "stresi" in kws
    assert "bir" not in kws and "bu" not in kws


def test_split_caption_balances():
    top, bottom = _split_caption("kod yazarken bug ile savasmak")
    assert top and bottom
    assert top.isupper()


@pytest.mark.asyncio
async def test_generate_offline_meme(tmp_path):
    r = await find_memes(text="pazartesi sendromu", sources=["generated"], generate=True)
    assert r.mode == "text"
    assert r.total >= 1
    gen = [s for s in r.suggestions if s.source == "generated"]
    assert gen and gen[0].local_path
    assert os.path.exists(gen[0].local_path)
    assert gen[0].top_text  # caption split produced text


@pytest.mark.asyncio
async def test_text_required_when_no_video():
    # No text, no video, only API sources that need keys -> empty but no crash.
    r = await find_memes(text="", sources=["tenor", "giphy"], generate=False)
    assert r.total == 0
    assert r.sources_used == []


@pytest.mark.asyncio
async def test_api_sources_skip_without_keys(monkeypatch):
    # Tenor/Giphy must be silently skipped when no API key is configured.
    from config import settings
    monkeypatch.setattr(settings, "TENOR_API_KEY", "")
    monkeypatch.setattr(settings, "GIPHY_API_KEY", "")
    r = await find_memes(text="cats", sources=["tenor", "giphy"], generate=False)
    assert "tenor" not in r.sources_used
    assert "giphy" not in r.sources_used


@pytest.mark.asyncio
async def test_imgflip_offline_mock(monkeypatch):
    # Mock the imgflip HTTP call so the test is deterministic and offline.
    fake = {
        "success": True,
        "data": {"memes": [
            {"name": "Drake Hotline Bling", "url": "https://i.imgflip.com/x.jpg"},
            {"name": "Success Kid", "url": "https://i.imgflip.com/y.jpg"},
        ]},
    }
    monkeypatch.setattr(meme_finder, "_http_json", lambda *a, **k: fake)
    r = await find_memes(text="drake success", sources=["imgflip"], generate=False)
    assert "imgflip" in r.sources_used
    assert any(s.source == "imgflip" and s.url for s in r.suggestions)
