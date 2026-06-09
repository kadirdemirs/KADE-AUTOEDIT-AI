import asyncio
import re
from typing import Callable, List, Optional

from models.result import BRollResult, BRollSuggestion
from utils.ffmpeg_utils import extract_audio


BROLL_PATTERNS = {
    "explanation": [
        r"\b(örneğin|mesela|yani|şöyle|böyle|demek ki|çünkü|nedeni|sebep)\b",
        r"\b(for example|such as|meaning|because|therefore|reason|basically)\b",
    ],
    "transition": [
        r"\b(şimdi|artık|geçelim|devam|sonra|önce|ilk|başlamak|bitirmek)\b",
        r"\b(now|next|first|then|finally|moving on|let's|start|begin)\b",
    ],
    "emphasis": [
        r"\b(önemli|kritik|dikkat|mutlaka|kesinlikle|en iyi|mükemmel|harika)\b",
        r"\b(important|critical|definitely|absolutely|amazing|perfect|best|key)\b",
    ],
    "intro": [
        r"\b(merhaba|hoşgeldiniz|bugün|bu videoda|size anlatacağım)\b",
        r"\b(hello|hi|welcome|today|in this video|i'll show|let me)\b",
    ],
}


async def suggest_broll(
    video_path: str,
    model_name: str = None,
    language: str = None,
    min_duration: float = 2.0,
    max_suggestions: int = 20,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> BRollResult:
    from config import settings
    model_name = model_name or settings.WHISPER_MODEL
    language = language or settings.WHISPER_LANGUAGE

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
        await progress_callback(0.75, "Analyzing for b-roll opportunities...")

    suggestions = _find_broll_moments(raw, min_duration, max_suggestions)
    total_dur = sum(s.duration for s in suggestions)

    if progress_callback:
        await progress_callback(1.0, "Done.")

    return BRollResult(
        suggestions=suggestions,
        total_suggestions=len(suggestions),
        total_broll_duration=round(total_dur, 2),
    )


def _run_whisper(audio_path: str, model_name: str, language: str) -> dict:
    import whisper
    model = whisper.load_model(model_name)
    return model.transcribe(audio_path, language=language, verbose=False)


def _classify_segment(text: str) -> tuple:
    """Returns (type, keyword, priority)."""
    text_lower = text.lower()

    for broll_type, patterns in BROLL_PATTERNS.items():
        for pattern in patterns:
            m = re.search(pattern, text_lower)
            if m:
                return broll_type, m.group(0).strip(), 0.8 if broll_type == "emphasis" else 0.6

    return "explanation", "", 0.4


def _extract_search_keywords(text: str) -> str:
    """Extract 2-3 meaningful nouns from text for stock footage search."""
    STOPWORDS = {
        "bir", "bu", "o", "ve", "de", "da", "ki", "ile", "için", "var", "yok",
        "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "is", "are",
        "was", "it", "this", "that", "i", "you", "we", "they", "have", "do", "not",
        "gibi", "kadar", "ama", "çok", "daha", "olan",
    }
    words = re.findall(r"\b[a-zA-ZğüşıöçĞÜŞİÖÇ]{4,}\b", text.lower())
    keywords = [w for w in words if w not in STOPWORDS]
    # Take first 3 unique
    seen, result = set(), []
    for w in keywords:
        if w not in seen:
            seen.add(w)
            result.append(w)
        if len(result) == 3:
            break
    return " ".join(result) if result else text[:30]


def _find_broll_moments(raw: dict, min_dur: float, max_n: int) -> List[BRollSuggestion]:
    segments = raw.get("segments", [])
    suggestions: List[BRollSuggestion] = []

    for seg in segments:
        text = seg.get("text", "").strip()
        start = float(seg.get("start", 0))
        end = float(seg.get("end", 0))
        duration = end - start

        if duration < min_dur:
            continue

        broll_type, trigger_word, priority = _classify_segment(text)
        search_query = _extract_search_keywords(text)

        suggestions.append(BRollSuggestion(
            start=round(start, 3),
            end=round(end, 3),
            duration=round(duration, 3),
            keyword=trigger_word or search_query.split()[0] if search_query else "general",
            search_query=search_query,
            type=broll_type,
            priority=priority,
        ))

    # Sort by priority, cap at max_n
    suggestions.sort(key=lambda s: s.priority, reverse=True)
    return suggestions[:max_n]
