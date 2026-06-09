import asyncio
import re
from typing import Callable, List, Optional

from models.result import AutoChaptersResult, Chapter
from utils.ffmpeg_utils import extract_audio


async def generate_chapters(
    video_path: str,
    model_name: str = None,
    language: str = None,
    min_chapter_duration: float = 30.0,
    max_chapters: int = 12,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> AutoChaptersResult:
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
        await progress_callback(0.75, "Detecting topic changes...")

    chapters = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _extract_chapters(raw, min_chapter_duration, max_chapters)
    )

    youtube_fmt = _to_youtube_format(chapters)
    desc_block = _to_description_block(chapters)

    if progress_callback:
        await progress_callback(1.0, "Chapters ready.")

    return AutoChaptersResult(
        chapters=chapters,
        total_chapters=len(chapters),
        youtube_format=youtube_fmt,
        description_block=desc_block,
    )


def _run_whisper(audio_path: str, model_name: str, language: str) -> dict:
    import whisper
    model = whisper.load_model(model_name)
    return model.transcribe(audio_path, language=language, verbose=False)


def _extract_keywords(text: str, top_n: int = 5) -> List[str]:
    """Simple TF-IDF-like keyword extraction without heavy NLP deps."""
    STOPWORDS_TR = {
        "bir", "bu", "o", "ve", "de", "da", "ki", "ile", "için",
        "var", "yok", "ne", "mi", "mu", "mü", "mı", "gibi", "kadar",
        "ama", "fakat", "çünkü", "çok", "daha", "olan", "olarak",
        "ben", "sen", "biz", "siz", "onlar", "bunu", "şu", "veya",
        "en", "hem", "ya", "diye", "ise", "bile", "hiç", "her", "bütün",
    }
    STOPWORDS_EN = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
        "for", "of", "with", "is", "are", "was", "be", "it", "this",
        "that", "i", "you", "we", "they", "have", "had", "do", "not",
        "so", "as", "if", "by", "from", "very", "just", "also", "about",
    }
    stopwords = STOPWORDS_TR | STOPWORDS_EN

    words = re.findall(r"\b[a-zA-ZğüşıöçĞÜŞİÖÇ]{4,}\b", text.lower())
    freq: dict = {}
    for w in words:
        if w not in stopwords:
            freq[w] = freq.get(w, 0) + 1

    sorted_words = sorted(freq, key=lambda x: freq[x], reverse=True)
    return sorted_words[:top_n]


def _segment_similarity(kw1: List[str], kw2: List[str]) -> float:
    if not kw1 or not kw2:
        return 0.0
    s1, s2 = set(kw1), set(kw2)
    return len(s1 & s2) / len(s1 | s2)


def _extract_chapters(raw: dict, min_dur: float, max_ch: int) -> List[Chapter]:
    segments = raw.get("segments", [])
    if not segments:
        return []

    total_duration = float(segments[-1].get("end", 0))

    # Group raw segments into coarser blocks (every 30s)
    block_size = max(min_dur, total_duration / (max_ch * 2))
    blocks: List[dict] = []
    current_text = []
    current_start = float(segments[0].get("start", 0))
    current_end = current_start

    for seg in segments:
        t = float(seg.get("end", 0))
        current_text.append(seg.get("text", ""))
        current_end = t
        if t - current_start >= block_size:
            blocks.append({
                "start": current_start,
                "end": current_end,
                "text": " ".join(current_text),
                "keywords": _extract_keywords(" ".join(current_text)),
            })
            current_start = t
            current_text = []

    if current_text:
        blocks.append({
            "start": current_start,
            "end": float(segments[-1].get("end", current_end)),
            "text": " ".join(current_text),
            "keywords": _extract_keywords(" ".join(current_text)),
        })

    if not blocks:
        return []

    # Merge similar consecutive blocks
    merged: List[dict] = [blocks[0]]
    for blk in blocks[1:]:
        sim = _segment_similarity(merged[-1]["keywords"], blk["keywords"])
        if sim > 0.4 and (blk["end"] - merged[-1]["start"]) < min_dur * 3:
            # Merge
            merged[-1]["end"] = blk["end"]
            merged[-1]["text"] += " " + blk["text"]
            merged[-1]["keywords"] = _extract_keywords(merged[-1]["text"])
        else:
            merged.append(blk)

    # Cap at max_chapters
    merged = merged[:max_chapters]

    # Generate titles from keywords
    chapters: List[Chapter] = []
    for i, blk in enumerate(merged):
        kw = blk["keywords"]
        title = _generate_title(blk["text"], kw, i)
        chapters.append(Chapter(
            index=i + 1,
            title=title,
            start=round(blk["start"], 2),
            end=round(blk["end"], 2),
            duration=round(blk["end"] - blk["start"], 2),
            keywords=kw[:5],
        ))

    return chapters


def _generate_title(text: str, keywords: List[str], idx: int) -> str:
    if not keywords:
        return f"Bölüm {idx + 1}"

    # Capitalize first keyword as title seed
    title = keywords[0].capitalize()
    if len(keywords) > 1:
        title += f" & {keywords[1].capitalize()}"

    # Special treatment for first/last chapter
    if idx == 0:
        return f"Giriş — {title}"

    return title


def _fmt_yt(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m}:{s:02d}"


def _to_youtube_format(chapters: List[Chapter]) -> str:
    return "\n".join(f"{_fmt_yt(ch.start)} {ch.title}" for ch in chapters)


def _to_description_block(chapters: List[Chapter]) -> str:
    lines = ["📌 Bölümler:", ""]
    for ch in chapters:
        lines.append(f"{_fmt_yt(ch.start)} — {ch.title}")
    return "\n".join(lines)
