import pytest
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from modules.silence_cutter import _build_cut_points
from models.result import CutPoint


def test_build_cut_points_basic():
    silence_ranges = [(1.0, 2.5), (5.0, 7.0)]
    cut_points = _build_cut_points(silence_ranges, keep_padding_ms=100, fade_ms=50)

    assert len(cut_points) == 2
    for cp in cut_points:
        assert isinstance(cp, CutPoint)
        assert cp.start < cp.end


def test_build_cut_points_padding_removes_short_silence():
    # 0.15s silence — with 100ms padding on each side it disappears
    silence_ranges = [(1.0, 1.15)]
    cut_points = _build_cut_points(silence_ranges, keep_padding_ms=100, fade_ms=50)
    assert len(cut_points) == 0


def test_build_cut_points_jcut():
    silence_ranges = [(1.0, 1.2)]  # 0.2s silence → j-cut after padding
    cut_points = _build_cut_points(silence_ranges, keep_padding_ms=0, fade_ms=0)
    assert len(cut_points) == 1
    assert cut_points[0].type == "j-cut"


def test_build_cut_points_lcut():
    silence_ranges = [(1.0, 3.5)]  # 2.5s silence → l-cut
    cut_points = _build_cut_points(silence_ranges, keep_padding_ms=0, fade_ms=0)
    assert len(cut_points) == 1
    assert cut_points[0].type == "l-cut"


def test_build_cut_points_regular_cut():
    silence_ranges = [(1.0, 1.8)]  # 0.8s silence → regular cut
    cut_points = _build_cut_points(silence_ranges, keep_padding_ms=0, fade_ms=0)
    assert len(cut_points) == 1
    assert cut_points[0].type == "cut"


@pytest.mark.asyncio
async def test_cut_silences_missing_file():
    from modules.silence_cutter import cut_silences
    with pytest.raises(Exception):
        await cut_silences("/nonexistent/file.mp4")
