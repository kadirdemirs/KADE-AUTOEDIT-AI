"""Utility helpers.

Lazy re-exports so importing one helper module (e.g. ffmpeg_utils, which has no
heavy deps) does not pull numpy via audio_utils. Access works as
`from utils import get_video_info`.
"""
import importlib

_EXPORTS = {
    "extract_audio": "ffmpeg_utils",
    "get_video_info": "ffmpeg_utils",
    "apply_cuts": "ffmpeg_utils",
    "normalize_audio": "ffmpeg_utils",
    "render_edit_plan": "ffmpeg_utils",
    "captions_to_ass": "ffmpeg_utils",
    "analyze_audio_levels": "audio_utils",
    "detect_silence_ranges": "audio_utils",
    "compute_rms": "audio_utils",
    "ensure_dir": "file_utils",
    "get_temp_path": "file_utils",
    "get_output_path": "file_utils",
    "cleanup_temp": "file_utils",
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    module_name = _EXPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module 'utils' has no attribute '{name}'")
    mod = importlib.import_module(f".{module_name}", __name__)
    return getattr(mod, name)
