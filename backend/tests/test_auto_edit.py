import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.result import (
    CutPoint, SilenceCutResult, AutoZoomResult, ZoomKeyframe,
    AutoCaptionsResult, Caption, CaptionWord, BRollResult, BRollSuggestion,
)
from models.edit_plan import EditPlan
from styles import get_style, list_styles
from modules import auto_edit
from modules.auto_edit import (
    _build_segments, _clip_and_merge, _make_time_mapper, _snap_cut, _assemble_plan,
)


# ── Styles ───────────────────────────────────────────────────────────────────

def test_styles_registered():
    ids = {s["id"] for s in list_styles()}
    assert {"talking_head", "viral_short", "beat_montage", "podcast", "cinematic"} <= ids


def test_talking_head_modules():
    style = get_style("talking_head")
    keys = [m[0] for m in style.modules]
    assert "silence" in keys and "zoom" in keys and "captions" in keys
    assert style.zoom_enabled and style.caption_style.enabled


def test_unknown_style_raises():
    with pytest.raises(KeyError):
        get_style("does_not_exist")


# ── Cut inversion & time mapping ─────────────────────────────────────────────

def test_build_segments_inverts_cuts():
    cuts = [CutPoint(start=2, end=3, type="cut"), CutPoint(start=5, end=6, type="cut")]
    segs = _build_segments(cuts, 0.0, 10.0)
    # 10s source minus two 1s removals -> 8s kept across 3 segments
    assert len(segs) == 3
    assert abs(sum(s.end - s.start for s in segs) - 8.0) < 1e-6


def test_clip_and_merge_overlaps():
    cuts = [CutPoint(start=2, end=4, type="cut"), CutPoint(start=3.5, end=5, type="cut")]
    merged = _clip_and_merge(cuts, 0.0, 10.0)
    assert len(merged) == 1
    assert merged[0].start == 2.0 and merged[0].end == 5.0


def test_time_mapper_skips_removed():
    segs = _build_segments([CutPoint(start=2, end=3, type="cut")], 0.0, 10.0)
    m = _make_time_mapper(segs)
    assert m(4.0) == pytest.approx(3.0)   # 1s removed before it
    assert m(2.5) is None                 # inside a removed region


def test_snap_to_beat():
    snapped = _snap_cut(CutPoint(start=2.1, end=4.9, type="cut"), [0.0, 2.0, 4.0, 6.0])
    assert snapped.start == 2.0 and snapped.end == 4.0


# ── Full plan assembly with fake module results ──────────────────────────────

def _fake_results():
    return {
        "silence": SilenceCutResult(
            cut_points=[CutPoint(start=2.0, end=3.0, type="cut")],
            total_silence_duration=1.0, total_kept_duration=9.0, cuts_count=1,
        ),
        "zoom": AutoZoomResult(
            keyframes=[ZoomKeyframe(time=5.0, scale=1.3, center_x=0.5, center_y=0.5, duration=0.3)],
            total_zooms=1, avg_scale=1.3,
        ),
        "captions": AutoCaptionsResult(
            captions=[Caption(
                index=0, start=4.0, end=5.0, text="merhaba dunya",
                words=[CaptionWord(word="merhaba", start=4.0, end=4.5),
                       CaptionWord(word="dunya", start=4.5, end=5.0)],
            )],
            total_captions=1, srt_content="", style="youtube", language="tr",
        ),
        "broll": BRollResult(
            suggestions=[BRollSuggestion(
                start=6.0, end=8.0, duration=2.0, keyword="ocean",
                search_query="ocean drone shot", type="explanation", priority=0.8,
            )],
            total_suggestions=1, total_broll_duration=2.0,
        ),
    }


def test_assemble_plan_talking_head():
    style = get_style("talking_head")
    plan = _assemble_plan(style, {}, source_duration=10.0, results=_fake_results())

    assert isinstance(plan, EditPlan)
    assert plan.style_id == "talking_head"
    # one 1s silence removed -> output shorter than source
    assert plan.output_duration < plan.source_duration
    assert plan.output_duration == pytest.approx(9.0)
    # zoom at source 5.0 -> output 4.0 (1s removed before)
    assert plan.zooms and plan.zooms[0].time == pytest.approx(4.0)
    # captions remapped onto output timeline
    assert plan.captions and plan.captions[0].words
    # b-roll became a marker with a query
    assert any(m.kind == "broll" and m.query for m in plan.markers)
    assert plan.stats["time_saved"] == pytest.approx(1.0)


def test_assemble_plan_respects_override_ratio():
    style = get_style("talking_head")
    plan = _assemble_plan(style, {"target_ratio": "9:16"}, 10.0, _fake_results())
    assert plan.target_ratio == "9:16"


# ── run_auto_edit with mocked module runners (no heavy deps, no render) ───────

@pytest.mark.asyncio
async def test_run_auto_edit_orchestration(monkeypatch):
    results = _fake_results()

    def fake_runners():
        async def silence(v, p, cb):
            await cb(1.0, "done")
            return results["silence"]
        async def zoom(v, p, cb):
            return results["zoom"]
        async def captions(v, p, cb):
            return results["captions"]
        async def broll(v, p, cb):
            return results["broll"]
        async def transcript(v, p, cb):
            from models.result import TranscriptResult
            return TranscriptResult(text="", language="tr", words=[],
                                    filler_cut_points=[], filler_words_found=[], confidence=1.0)
        return {"silence": silence, "zoom": zoom, "captions": captions,
                "broll": broll, "transcript": transcript}

    monkeypatch.setattr(auto_edit, "_build_module_runners", fake_runners)
    monkeypatch.setattr(auto_edit, "get_video_info", lambda v: {"duration": 10.0, "resolution": "1920x1080"})

    progress = []
    async def cb(pct, msg):
        progress.append(pct)

    result = await auto_edit.run_auto_edit(
        "fake.mp4", style_id="talking_head", render=False, progress_callback=cb,
    )

    assert result.plan.output_duration == pytest.approx(9.0)
    assert result.render_path is None
    assert progress and progress[-1] == pytest.approx(1.0)
