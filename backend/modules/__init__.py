"""Analysis modules.

Exposes each module's public entry point lazily so importing a single submodule
(e.g. `import modules.auto_edit`) does not force every heavy dependency
(librosa, whisper, opencv) to load. Access still works as
`from modules import cut_silences`.
"""
import importlib

_EXPORTS = {
    "cut_silences": "silence_cutter",
    "transcribe_audio": "whisper_transcript",
    "detect_beats": "beat_sync",
    "detect_scenes": "scene_detector",
    "analyze_color_audio": "auto_color",
    "generate_captions": "auto_captions",
    "detect_zoom_points": "auto_zoom",
    "detect_viral_segments": "viral_detector",
    "detect_speakers": "podcast_mode",
    "detect_repeats": "repeat_detector",
    "filter_profanity": "profanity_filter",
    "generate_chapters": "auto_chapters",
    "analyze_resize": "auto_resize",
    "suggest_broll": "broll_suggest",
    "find_memes": "meme_finder",
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    module_name = _EXPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module 'modules' has no attribute '{name}'")
    mod = importlib.import_module(f".{module_name}", __name__)
    return getattr(mod, name)
