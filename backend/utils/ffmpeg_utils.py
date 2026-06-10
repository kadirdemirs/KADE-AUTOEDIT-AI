import json
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional

from config import settings


def run_ffprobe(video_path: str) -> Dict[str, Any]:
    cmd = [
        settings.FFPROBE_PATH, "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(video_path)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def get_video_info(video_path: str) -> Dict[str, Any]:
    probe = run_ffprobe(video_path)
    video_stream = next(
        (s for s in probe["streams"] if s["codec_type"] == "video"), None
    )
    audio_stream = next(
        (s for s in probe["streams"] if s["codec_type"] == "audio"), None
    )

    duration = float(probe["format"].get("duration", 0))
    file_size = int(probe["format"].get("size", 0))

    result = {
        "duration": duration,
        "fps": 25.0,
        "resolution": "unknown",
        "has_audio": audio_stream is not None,
        "audio_channels": 0,
        "audio_sample_rate": 0,
        "codec": "unknown",
        "file_size": file_size,
    }

    if video_stream:
        fps_parts = video_stream.get("r_frame_rate", "25/1").split("/")
        result["fps"] = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 else 25.0
        result["resolution"] = f"{video_stream.get('width', 0)}x{video_stream.get('height', 0)}"
        result["codec"] = video_stream.get("codec_name", "unknown")

    if audio_stream:
        result["audio_channels"] = int(audio_stream.get("channels", 0))
        result["audio_sample_rate"] = int(audio_stream.get("sample_rate", 0))

    return result


def extract_audio(video_path: str, output_path: str = None) -> str:
    if output_path is None:
        stem = Path(video_path).stem
        output_path = str(settings.TEMP_DIR / f"{stem}_audio.wav")

    cmd = [
        settings.FFMPEG_PATH, "-y", "-i", str(video_path),
        "-vn", "-acodec", "pcm_s16le",
        "-ar", "16000", "-ac", "1",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path


def apply_cuts(video_path: str, keep_segments: List[Dict], output_path: str = None) -> str:
    """Apply cut points to video, keeping only the specified segments."""
    if output_path is None:
        stem = Path(video_path).stem
        output_path = str(settings.OUTPUT_DIR / f"{stem}_cut.mp4")

    if not keep_segments:
        return video_path

    # Build complex filter for trimming
    filter_parts = []
    concat_parts = []

    for i, seg in enumerate(keep_segments):
        start = seg["start"]
        end = seg["end"]
        filter_parts.append(
            f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}];"
            f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]"
        )
        concat_parts.append(f"[v{i}][a{i}]")

    n = len(keep_segments)
    filter_complex = ";".join(filter_parts) + ";" + "".join(concat_parts) + f"concat=n={n}:v=1:a=1[outv][outa]"

    cmd = [
        settings.FFMPEG_PATH, "-y", "-i", str(video_path),
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-c:a", "aac",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path


# ── Auto Edit rendering ─────────────────────────────────────────────────────────

_RATIO_MAP = {"9:16": (9, 16), "1:1": (1, 1), "16:9": (16, 9), "4:5": (4, 5)}


def _ass_time(seconds: float) -> str:
    """ASS uses H:MM:SS.cs (centiseconds)."""
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def captions_to_ass(captions: List[Dict[str, Any]], caption_style: Dict[str, Any]) -> str:
    """Build an .ass karaoke subtitle from word-timed captions.

    Each caption's words become `{\\k<cs>}word ` runs so the active word is
    highlighted in sync (Submagic/CapCut style). `captions` items are dicts with
    keys: start, end, text, words[{word,start,end}].
    """
    cs = caption_style or {}
    font = cs.get("font", "Arial")
    size = int(cs.get("font_size", 64))
    primary = cs.get("primary_color", "&H00FFFFFF")
    highlight = cs.get("highlight_color", "&H0000F0FF")
    outline_color = cs.get("outline_color", "&H00000000")
    outline = int(cs.get("outline", 3))
    uppercase = bool(cs.get("uppercase", True))
    pos = cs.get("position", "center")
    alignment = {"bottom": 2, "center": 5, "top": 8}.get(pos, 5)

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1080\n"
        "PlayResY: 1920\n"
        "WrapStyle: 2\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, "
        "ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Kade,{font},{size},{primary},{highlight},{outline_color},"
        f"&H64000000,-1,0,0,0,100,100,0,0,1,{outline},1,{alignment},60,60,120,1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    lines = []
    for cap in captions:
        words = cap.get("words") or []
        if words:
            chunks = []
            for w in words:
                token = (w.get("word") or "").strip()
                if not token:
                    continue
                if uppercase:
                    token = token.upper()
                dur_cs = max(1, int(round((w["end"] - w["start"]) * 100)))
                chunks.append(f"{{\\k{dur_cs}}}{token} ")
            text = "".join(chunks).strip()
            start, end = words[0]["start"], words[-1]["end"]
        else:
            text = (cap.get("text") or "").strip()
            if uppercase:
                text = text.upper()
            start, end = cap.get("start", 0.0), cap.get("end", 0.0)
        if not text:
            continue
        lines.append(
            f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Kade,,0,0,0,,{text}"
        )

    return header + "\n".join(lines) + "\n"


def _reframe_filter(orig_w: int, orig_h: int, target_ratio: str) -> Optional[str]:
    """Center-crop + scale to a target aspect ratio. Returns an ffmpeg filter or None."""
    if target_ratio not in _RATIO_MAP or orig_w <= 0 or orig_h <= 0:
        return None
    rw, rh = _RATIO_MAP[target_ratio]
    target = rw / rh
    src = orig_w / orig_h
    if abs(src - target) < 1e-3:
        return None
    if src > target:
        crop_w = int(round(orig_h * target))
        crop_w -= crop_w % 2
        return f"crop={crop_w}:{orig_h}:(iw-{crop_w})/2:0"
    crop_h = int(round(orig_w / target))
    crop_h -= crop_h % 2
    return f"crop={orig_w}:{crop_h}:0:(ih-{crop_h})/2"


def render_edit_plan(
    video_path: str,
    keep_segments: List[Dict[str, float]],
    output_path: Optional[str] = None,
    *,
    ass_path: Optional[str] = None,
    target_ratio: Optional[str] = None,
    audio_gain_db: float = 0.0,
    normalize_audio_to: Optional[float] = None,
) -> str:
    """Render a full edit: trim to kept segments, optional reframe, caption burn-in,
    and audio normalization — all in one ffmpeg pass.
    """
    if output_path is None:
        stem = Path(video_path).stem
        output_path = str(settings.OUTPUT_DIR / f"{stem}_autoedit.mp4")

    if not keep_segments:
        keep_segments = [{"start": 0.0, "end": get_video_info(video_path)["duration"]}]

    info = get_video_info(video_path)
    try:
        orig_w, orig_h = (int(x) for x in info["resolution"].split("x"))
    except Exception:
        orig_w, orig_h = 0, 0

    # 1) trim + concat kept segments
    v_parts, a_parts, concat = [], [], []
    for i, seg in enumerate(keep_segments):
        start, end = seg["start"], seg["end"]
        v_parts.append(f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]")
        a_parts.append(f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]")
        concat.append(f"[v{i}][a{i}]")
    n = len(keep_segments)
    chain = v_parts + a_parts
    chain.append("".join(concat) + f"concat=n={n}:v=1:a=1[cv][ca]")

    vlabel, alabel = "[cv]", "[ca]"

    # 2) reframe
    reframe = _reframe_filter(orig_w, orig_h, target_ratio) if target_ratio else None
    if reframe:
        chain.append(f"{vlabel}{reframe}[rv]")
        vlabel = "[rv]"

    # 3) caption burn-in (ass=) — path needs escaping for the filtergraph
    if ass_path:
        esc = ass_path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        chain.append(f"{vlabel}ass='{esc}'[bv]")
        vlabel = "[bv]"

    # 4) audio: gain and/or loudnorm
    afilters = []
    if abs(audio_gain_db) > 0.01:
        afilters.append(f"volume={audio_gain_db}dB")
    if normalize_audio_to is not None:
        afilters.append(f"loudnorm=I={normalize_audio_to}:TP=-1.5:LRA=11")
    if afilters:
        chain.append(f"{alabel}{','.join(afilters)}[oa]")
        alabel = "[oa]"

    filter_complex = ";".join(chain)

    cmd = [
        settings.FFMPEG_PATH, "-y", "-i", str(video_path),
        "-filter_complex", filter_complex,
        "-map", vlabel, "-map", alabel,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path


def normalize_audio(audio_path: str, target_lufs: float = -14.0, output_path: str = None) -> str:
    if output_path is None:
        stem = Path(audio_path).stem
        output_path = str(settings.OUTPUT_DIR / f"{stem}_normalized.wav")

    # Two-pass loudnorm
    cmd = [
        settings.FFMPEG_PATH, "-y", "-i", str(audio_path),
        "-af", f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path
