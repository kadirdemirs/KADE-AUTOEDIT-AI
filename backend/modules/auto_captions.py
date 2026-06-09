import asyncio
import re
from typing import Callable, List, Optional

from config import settings
from models.result import AutoCaptionsResult, Caption, CaptionWord
from utils.ffmpeg_utils import extract_audio


CAPTION_STYLES = {
    "tiktok":   {"max_words": 3,  "max_chars": 20},
    "youtube":  {"max_words": 8,  "max_chars": 60},
    "podcast":  {"max_words": 12, "max_chars": 80},
    "minimal":  {"max_words": 5,  "max_chars": 35},
}


async def generate_captions(
    video_path: str,
    model_name: str = None,
    language: str = None,
    style: str = "youtube",
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> AutoCaptionsResult:
    model_name = model_name or settings.WHISPER_MODEL
    language = language or settings.WHISPER_LANGUAGE
    cfg = CAPTION_STYLES.get(style, CAPTION_STYLES["youtube"])

    if progress_callback:
        await progress_callback(0.05, "Extracting audio...")

    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.15, f"Transcribing ({model_name})...")

    raw = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _run_whisper(audio_path, model_name, language)
    )

    if progress_callback:
        await progress_callback(0.75, "Building captions...")

    captions = _build_captions(raw, cfg["max_words"], cfg["max_chars"])
    srt = _to_srt(captions)
    detected_lang = raw.get("language", language)

    if progress_callback:
        await progress_callback(1.0, "Done.")

    return AutoCaptionsResult(
        captions=captions,
        total_captions=len(captions),
        srt_content=srt,
        style=style,
        language=detected_lang,
    )


def _run_whisper(audio_path: str, model_name: str, language: str) -> dict:
    import whisper
    model = whisper.load_model(model_name)
    return model.transcribe(audio_path, language=language, word_timestamps=True, verbose=False)


def _build_captions(result: dict, max_words: int, max_chars: int) -> List[Caption]:
    all_words: List[CaptionWord] = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []):
            text = w.get("word", "").strip()
            if not text:
                continue
            all_words.append(CaptionWord(
                word=text,
                start=float(w.get("start", 0)),
                end=float(w.get("end", 0)),
            ))

    captions: List[Caption] = []
    idx = 0
    i = 0

    while i < len(all_words):
        group: List[CaptionWord] = []
        char_count = 0

        while i < len(all_words) and len(group) < max_words:
            w = all_words[i]
            if char_count + len(w.word) + 1 > max_chars and group:
                break
            group.append(w)
            char_count += len(w.word) + 1
            i += 1

        if not group:
            break

        text = " ".join(w.word for w in group).strip()
        # Clean punctuation artifacts at start
        text = re.sub(r"^\W+", "", text)

        captions.append(Caption(
            index=idx + 1,
            start=group[0].start,
            end=group[-1].end,
            text=text,
            words=group,
        ))
        idx += 1

    return captions


def _fmt_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _to_srt(captions: List[Caption]) -> str:
    lines = []
    for cap in captions:
        lines.append(str(cap.index))
        lines.append(f"{_fmt_srt_time(cap.start)} --> {_fmt_srt_time(cap.end)}")
        lines.append(cap.text)
        lines.append("")
    return "\n".join(lines)
