import json
import subprocess
from pathlib import Path
from typing import Dict, List, Any

from config import settings


def run_ffprobe(video_path: str) -> Dict[str, Any]:
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
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
        "ffmpeg", "-y", "-i", str(video_path),
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
        "ffmpeg", "-y", "-i", str(video_path),
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-c:a", "aac",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path


def normalize_audio(audio_path: str, target_lufs: float = -14.0, output_path: str = None) -> str:
    if output_path is None:
        stem = Path(audio_path).stem
        output_path = str(settings.OUTPUT_DIR / f"{stem}_normalized.wav")

    # Two-pass loudnorm
    cmd = [
        "ffmpeg", "-y", "-i", str(audio_path),
        "-af", f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path
