import asyncio
from typing import Callable, List, Optional

from models.result import BleepPoint, ProfanityResult
from utils.ffmpeg_utils import extract_audio

# ── Word lists ─────────────────────────────────────────────────────────────────
TR_PROFANITY = {
    "sik", "sikerim", "orospu", "kahpe", "göt", "oç", "amk", "amq",
    "piç", "piçlik", "yarrak", "yarak", "salak", "gerizekalı",
    "bok", "boktan", "sikeyim", "amına", "orosbuçocuğu", "pezevenk",
    "ibne", "it", "köpek", "şerefsiz", "haysiyetsiz", "alçak",
}

EN_PROFANITY = {
    "fuck", "fucking", "fucked", "fucker", "fucks",
    "shit", "shitty", "bullshit",
    "bitch", "bitches",
    "ass", "asshole", "asses",
    "damn", "hell",
    "crap", "cunt", "dick", "cock", "pussy",
    "bastard", "motherfucker", "dumbass", "jackass",
}

ALL_PROFANITY = TR_PROFANITY | EN_PROFANITY


async def filter_profanity(
    video_path: str,
    model_name: str = None,
    language: str = None,
    replacement: str = "bleep",
    custom_words: Optional[List[str]] = None,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> ProfanityResult:
    from config import settings
    model_name = model_name or settings.WHISPER_MODEL
    language = language or settings.WHISPER_LANGUAGE

    word_set = ALL_PROFANITY.copy()
    if custom_words:
        word_set.update(w.lower().strip() for w in custom_words)

    if progress_callback:
        await progress_callback(0.05, "Extracting audio...")

    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.15, "Transcribing...")

    raw = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _run_whisper(audio_path, model_name, language)
    )

    if progress_callback:
        await progress_callback(0.8, "Detecting profanity...")

    bleep_points, words_found, clean_text = _detect_profanity(raw, word_set, replacement)

    if progress_callback:
        await progress_callback(1.0, "Done.")

    return ProfanityResult(
        bleep_points=bleep_points,
        total_found=len(bleep_points),
        words_found=words_found,
        clean_transcript=clean_text,
    )


def _run_whisper(audio_path: str, model_name: str, language: str) -> dict:
    import whisper
    model = whisper.load_model(model_name)
    return model.transcribe(audio_path, language=language, word_timestamps=True, verbose=False)


def _clean_word(w: str) -> str:
    import re
    return re.sub(r"[^\w]", "", w).lower()


def _detect_profanity(
    raw: dict,
    word_set: set,
    replacement: str,
) -> tuple:
    bleep_points: List[BleepPoint] = []
    found_set: set = set()
    clean_parts: List[str] = []

    for seg in raw.get("segments", []):
        seg_clean = []
        for w_data in seg.get("words", []):
            word_raw = w_data.get("word", "").strip()
            word_clean = _clean_word(word_raw)
            start = float(w_data.get("start", 0))
            end = float(w_data.get("end", 0))

            if word_clean in word_set:
                bleep_points.append(BleepPoint(
                    start=max(0, start - 0.05),
                    end=end + 0.05,
                    word=word_raw,
                    replacement=replacement,
                ))
                found_set.add(word_raw)
                seg_clean.append("[*]")
            else:
                seg_clean.append(word_raw)

        clean_parts.append(" ".join(seg_clean))

    clean_text = " ".join(clean_parts).strip()
    return bleep_points, sorted(found_set), clean_text
