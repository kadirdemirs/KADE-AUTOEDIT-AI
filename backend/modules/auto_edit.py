"""Auto Edit orchestrator.

Takes a style preset, runs the right existing analysis modules in order, and
merges their outputs into a single EditPlan (kept segments, zoom/caption/marker
events, color, audio gain). Optionally renders a standalone MP4 via ffmpeg.

This module owns NO analysis logic of its own — it reuses the 15 modules under
backend/modules/* and the helpers in utils/ffmpeg_utils.py.
"""
import asyncio
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from config import settings
from models.edit_plan import (
    AutoEditResult, BeatGrid, CaptionEvent, CaptionWordEvent, EditColor,
    EditPlan, MarkerEvent, TimelineSegment, ZoomEvent,
)
from models.result import CutPoint
from styles import get_style
from styles.presets import StyleConfig
from utils.ffmpeg_utils import (
    captions_to_ass, get_video_info, render_edit_plan,
)


def _build_module_runners() -> Dict[str, Callable]:
    """Import the heavy analysis modules lazily, only when an edit actually runs.

    Keeping these imports out of module load time lets the orchestrator's pure
    plan-assembly logic be imported and tested without librosa/whisper/etc.
    """
    from modules.silence_cutter import cut_silences
    from modules.whisper_transcript import transcribe_audio
    from modules.beat_sync import detect_beats
    from modules.scene_detector import detect_scenes
    from modules.auto_color import analyze_color_audio
    from modules.auto_captions import generate_captions
    from modules.auto_zoom import detect_zoom_points
    from modules.viral_detector import detect_viral_segments
    from modules.podcast_mode import detect_speakers
    from modules.repeat_detector import detect_repeats
    from modules.auto_chapters import generate_chapters
    from modules.auto_resize import analyze_resize
    from modules.broll_suggest import suggest_broll

    return {
        "silence":    lambda v, p, cb: cut_silences(v, progress_callback=cb, **p),
        "transcript": lambda v, p, cb: transcribe_audio(v, progress_callback=cb, **p),
        "beat":       lambda v, p, cb: detect_beats(v, progress_callback=cb, **p),
        "scene":      lambda v, p, cb: detect_scenes(v, progress_callback=cb, **p),
        "color":      lambda v, p, cb: analyze_color_audio(v, progress_callback=cb, **p),
        "captions":   lambda v, p, cb: generate_captions(v, progress_callback=cb, **p),
        "zoom":       lambda v, p, cb: detect_zoom_points(v, progress_callback=cb, **p),
        "viral":      lambda v, p, cb: detect_viral_segments(v, progress_callback=cb, **p),
        "podcast":    lambda v, p, cb: detect_speakers(v, progress_callback=cb, **p),
        "repeat":     lambda v, p, cb: detect_repeats(v, progress_callback=cb, **p),
        "chapters":   lambda v, p, cb: generate_chapters(v, progress_callback=cb, **p),
        "resize":     lambda v, p, cb: analyze_resize(v, progress_callback=cb, **p),
        "broll":      lambda v, p, cb: suggest_broll(v, progress_callback=cb, **p),
    }


async def run_auto_edit(
    video_path: str,
    style_id: str,
    overrides: Optional[Dict[str, Any]] = None,
    render: bool = False,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> AutoEditResult:
    style = get_style(style_id)
    overrides = overrides or {}
    style = _apply_overrides_to_style(style, overrides)

    info = await asyncio.get_event_loop().run_in_executor(None, get_video_info, video_path)
    source_duration = float(info.get("duration", 0.0))

    # Run each module, mapping its 0..1 progress into an overall slice.
    runners = _build_module_runners()
    results = await _run_modules(video_path, style, runners, progress_callback)

    if progress_callback:
        await progress_callback(0.85, "Building edit plan...")

    plan = _assemble_plan(style, overrides, source_duration, results)

    result = AutoEditResult(plan=plan)

    if render:
        if progress_callback:
            await progress_callback(0.9, "Rendering MP4...")
        result.render_path, result.ass_path = await _render(video_path, style, plan)

    if progress_callback:
        await progress_callback(1.0, "Auto edit done.")
    return result


def _apply_overrides_to_style(style: StyleConfig, overrides: Dict[str, Any]) -> StyleConfig:
    """Return a style copy with user-facing panel controls applied to module params."""
    updated = style.model_copy(deep=True)
    module_params = overrides.get("module_params") or {}

    # Backward-compatible flat keys used by early panel builds.
    silence_keys = {"threshold_db", "min_silence_ms", "keep_padding_ms", "fade_ms"}
    flat_silence = {k: overrides[k] for k in silence_keys if k in overrides}
    if flat_silence:
        module_params = {**module_params, "silence": {**module_params.get("silence", {}), **flat_silence}}

    if not module_params:
        return updated

    patched = []
    for key, params in updated.modules:
        extra = module_params.get(key)
        if isinstance(extra, dict):
            merged = {**params, **extra}
            patched.append((key, merged))
        else:
            patched.append((key, params))
    updated.modules = patched
    return updated


# ── Module execution ─────────────────────────────────────────────────────────

async def _run_modules(
    video_path: str,
    style: StyleConfig,
    runners: Dict[str, Callable],
    progress_callback: Optional[Callable[[float, str], None]],
) -> Dict[str, Any]:
    results: Dict[str, Any] = {}
    mods = style.modules
    n = max(1, len(mods))
    # Reserve 0..0.85 of the total bar for analysis (rest is plan + render).
    span = 0.85 / n

    for i, (key, params) in enumerate(mods):
        runner = runners.get(key)
        if not runner:
            continue
        base = i * span

        async def sub_progress(pct: float, message: str, _base=base, _key=key):
            if progress_callback:
                await progress_callback(_base + pct * span, f"[{_key}] {message}")

        results[key] = await runner(video_path, dict(params), sub_progress)

    return results


# ── Plan assembly ────────────────────────────────────────────────────────────

def _assemble_plan(
    style: StyleConfig,
    overrides: Dict[str, Any],
    source_duration: float,
    results: Dict[str, Any],
) -> EditPlan:
    # --- 1. Optionally narrow to a viral window (viral_short) ---
    window_start, window_end = 0.0, source_duration
    viral = results.get("viral")
    if viral and getattr(viral, "best_segment", None):
        window_start = viral.best_segment.start
        window_end = viral.best_segment.end

    # --- 2. Collect removal cuts from every source that produces them ---
    removed: List[CutPoint] = []
    if (sil := results.get("silence")):
        removed.extend(sil.cut_points)
    if (tr := results.get("transcript")):
        removed.extend(tr.filler_cut_points)
    if (rep := results.get("repeat")):
        removed.extend(rep.cuts_suggested)

    # Beat grid (for snapping / Premiere markers)
    beat_grid = None
    if (beat := results.get("beat")):
        beat_grid = BeatGrid(bpm=beat.bpm, beats=list(beat.beat_timestamps))

    # Clip cuts to the active window and merge overlaps.
    cuts = _clip_and_merge(removed, window_start, window_end)
    if style.snap_to_beat and beat_grid and beat_grid.beats:
        cuts = [_snap_cut(c, beat_grid.beats) for c in cuts]

    # --- 3. Invert cuts -> kept segments, build output timeline ---
    segments = _build_segments(cuts, window_start, window_end)
    output_duration = sum(s.end - s.start for s in segments)

    # Map source time -> output time (needed for zoom/caption alignment).
    src_to_out = _make_time_mapper(segments)

    # --- 4. Zoom events ---
    zooms: List[ZoomEvent] = []
    if style.zoom_enabled and (zoom := results.get("zoom")):
        for kf in zoom.keyframes:
            out_t = src_to_out(kf.time)
            if out_t is None:
                continue
            zooms.append(ZoomEvent(
                time=round(out_t, 3), scale=kf.scale,
                center_x=kf.center_x, center_y=kf.center_y, duration=kf.duration,
            ))

    # --- 5. Captions (remapped to output timeline) ---
    captions: List[CaptionEvent] = []
    if style.caption_style.enabled and (cap := results.get("captions")):
        captions = _remap_captions(cap.captions, src_to_out)

    # --- 6. Markers: b-roll, chapters, viral ---
    markers = _build_markers(results, src_to_out)

    # --- 7. Color + audio ---
    color = None
    audio_gain = 0.0
    if (col := results.get("color")):
        if style.apply_color:
            cset = col.color_settings
            color = EditColor(
                brightness=cset.brightness, contrast=cset.contrast,
                saturation=cset.saturation, temperature=cset.temperature,
                tint=cset.tint, lut_suggestion=cset.lut_suggestion,
            )
        audio_gain = col.audio_settings.gain_db

    target_ratio = overrides.get("target_ratio", style.target_ratio)

    return EditPlan(
        style_id=style.id,
        source_duration=round(source_duration, 3),
        output_duration=round(output_duration, 3),
        target_ratio=target_ratio,
        segments=segments,
        zooms=zooms,
        captions=captions,
        markers=markers,
        beat_grid=beat_grid,
        color=color,
        audio_gain_db=round(audio_gain, 2),
        removed_cuts=cuts,
        stats={
            "cuts": float(len(cuts)),
            "segments": float(len(segments)),
            "zooms": float(len(zooms)),
            "captions": float(len(captions)),
            "markers": float(len(markers)),
            "time_saved": round(max(0.0, (window_end - window_start) - output_duration), 2),
        },
    )


def _clip_and_merge(cuts: List[CutPoint], lo: float, hi: float) -> List[CutPoint]:
    """Clip cuts to [lo, hi], drop empties, merge overlapping/adjacent ones."""
    clipped = []
    for c in cuts:
        s, e = max(lo, c.start), min(hi, c.end)
        if e - s > 0.02:
            clipped.append((s, e, c))
    clipped.sort(key=lambda x: x[0])

    merged: List[CutPoint] = []
    for s, e, c in clipped:
        if merged and s <= merged[-1].end + 0.05:
            if e > merged[-1].end:
                merged[-1] = CutPoint(
                    start=merged[-1].start, end=e, type=merged[-1].type,
                    label=merged[-1].label, confidence=merged[-1].confidence,
                )
        else:
            merged.append(CutPoint(start=round(s, 3), end=round(e, 3),
                                   type=c.type, label=c.label, confidence=c.confidence))
    return merged


def _snap_cut(cut: CutPoint, beats: List[float]) -> CutPoint:
    return CutPoint(
        start=_nearest(cut.start, beats), end=_nearest(cut.end, beats),
        type=cut.type, label=cut.label, confidence=cut.confidence,
    )


def _nearest(t: float, beats: List[float]) -> float:
    return round(min(beats, key=lambda b: abs(b - t)), 3) if beats else t


def _build_segments(cuts: List[CutPoint], lo: float, hi: float) -> List[TimelineSegment]:
    """Invert removal cuts within [lo, hi] into kept segments on the output timeline."""
    segments: List[TimelineSegment] = []
    cursor = lo
    out_pos = 0.0
    for c in cuts:
        if c.start > cursor + 0.02:
            seg_len = c.start - cursor
            segments.append(TimelineSegment(
                start=round(out_pos, 3), end=round(out_pos + seg_len, 3),
                source_start=round(cursor, 3), source_end=round(c.start, 3),
            ))
            out_pos += seg_len
        cursor = max(cursor, c.end)
    if hi > cursor + 0.02:
        seg_len = hi - cursor
        segments.append(TimelineSegment(
            start=round(out_pos, 3), end=round(out_pos + seg_len, 3),
            source_start=round(cursor, 3), source_end=round(hi, 3),
        ))
    return segments


def _make_time_mapper(segments: List[TimelineSegment]) -> Callable[[float], Optional[float]]:
    """Map a source timestamp to its output-timeline position, or None if removed."""
    def mapper(src_t: float) -> Optional[float]:
        for seg in segments:
            if seg.source_start <= src_t <= seg.source_end:
                return seg.start + (src_t - seg.source_start)
        return None
    return mapper


def _remap_captions(captions: List, mapper) -> List[CaptionEvent]:
    out: List[CaptionEvent] = []
    idx = 0
    for cap in captions:
        words = []
        for w in cap.words:
            ws, we = mapper(w.start), mapper(w.end)
            if ws is None or we is None or we <= ws:
                continue
            words.append(CaptionWordEvent(word=w.word, start=round(ws, 3), end=round(we, 3)))
        if not words:
            continue
        out.append(CaptionEvent(
            index=idx, start=words[0].start, end=words[-1].end,
            text=cap.text, words=words,
        ))
        idx += 1
    return out


def _build_markers(results: Dict[str, Any], mapper) -> List[MarkerEvent]:
    markers: List[MarkerEvent] = []
    if (broll := results.get("broll")):
        for s in broll.suggestions:
            t = mapper(s.start)
            if t is None:
                continue
            markers.append(MarkerEvent(
                time=round(t, 3), label=f"B-roll: {s.keyword}",
                kind="broll", query=s.search_query,
            ))
    if (ch := results.get("chapters")):
        for c in ch.chapters:
            t = mapper(c.start)
            if t is None:
                continue
            markers.append(MarkerEvent(time=round(t, 3), label=c.title, kind="chapter"))
    markers.sort(key=lambda m: m.time)
    return markers


# ── Rendering ────────────────────────────────────────────────────────────────

async def _render(
    video_path: str, style: StyleConfig, plan: EditPlan,
) -> Tuple[str, Optional[str]]:
    keep = [{"start": s.source_start, "end": s.source_end} for s in plan.segments]
    rdefaults = style.render_defaults

    ass_path: Optional[str] = None
    if rdefaults.get("burn_captions", True) and plan.captions:
        ass_path = await asyncio.get_event_loop().run_in_executor(
            None, _write_ass, video_path, plan, style,
        )

    normalize_to = settings.TARGET_LUFS if rdefaults.get("normalize_audio", True) else None

    out = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: render_edit_plan(
            video_path, keep,
            ass_path=ass_path,
            target_ratio=plan.target_ratio,
            audio_gain_db=plan.audio_gain_db,
            normalize_audio_to=normalize_to,
        ),
    )
    return out, ass_path


def _write_ass(video_path: str, plan: EditPlan, style: StyleConfig) -> str:
    caps = [c.model_dump() for c in plan.captions]
    ass = captions_to_ass(caps, style.caption_style.model_dump())
    stem = Path(video_path).stem
    ass_path = str(settings.TEMP_DIR / f"{stem}_captions.ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass)
    return ass_path
