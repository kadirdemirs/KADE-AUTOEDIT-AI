import asyncio
from typing import Callable, List, Optional

from config import settings
from models.result import CutPoint, TranscriptResult, WordTimestamp
from utils.ffmpeg_utils import extract_audio


async def transcribe_audio(
    video_path: str,
    model_name: str = None,
    language: str = None,
    detect_fillers: bool = True,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> TranscriptResult:
    model_name = model_name or settings.WHISPER_MODEL
    language = language or settings.WHISPER_LANGUAGE
    filler_words = settings.FILLER_WORDS

    if progress_callback:
        await progress_callback(0.05, "Extracting audio...")

    audio_path = await asyncio.get_event_loop().run_in_executor(
        None, extract_audio, video_path
    )

    if progress_callback:
        await progress_callback(0.15, f"Loading Whisper model: {model_name}...")

    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _run_whisper(audio_path, model_name, language)
    )

    if progress_callback:
        await progress_callback(0.8, "Processing word timestamps...")

    words, filler_cut_points, fillers_found = _process_words(
        result, filler_words, detect_fillers
    )

    confidence = _compute_confidence(result)

    if progress_callback:
        await progress_callback(1.0, "Transcription complete.")

    return TranscriptResult(
        text=result.get("text", "").strip(),
        language=result.get("language", language),
        words=words,
        filler_cut_points=filler_cut_points,
        filler_words_found=fillers_found,
        confidence=confidence,
    )


def _run_whisper(audio_path: str, model_name: str, language: str) -> dict:
    import whisper
    model = whisper.load_model(model_name)
    result = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,
        verbose=False,
    )
    return result


def _process_words(
    result: dict,
    filler_words: List[str],
    detect_fillers: bool,
) -> tuple:
    words: List[WordTimestamp] = []
    filler_cut_points: List[CutPoint] = []
    fillers_found: List[str] = []

    filler_set = {w.lower().strip() for w in filler_words}

    for segment in result.get("segments", []):
        for word_data in segment.get("words", []):
            word_text = word_data.get("word", "").strip()
            start = float(word_data.get("start", 0))
            end = float(word_data.get("end", 0))

            is_filler = False
            if detect_fillers and word_text.lower().strip(".,!?") in filler_set:
                is_filler = True
                if word_text not in fillers_found:
                    fillers_found.append(word_text)

                # Add small buffer so cut doesn't clip adjacent words
                filler_cut_points.append(CutPoint(
                    start=max(0, start - 0.05),
                    end=end + 0.05,
                    type="filler",
                    label=f"filler:{word_text}",
                    confidence=0.9,
                ))

            words.append(WordTimestamp(
                word=word_text,
                start=start,
                end=end,
                is_filler=is_filler,
            ))

    return words, filler_cut_points, fillers_found


def _compute_confidence(result: dict) -> float:
    segments = result.get("segments", [])
    if not segments:
        return 0.0
    total = sum(abs(seg.get("avg_logprob", -1)) for seg in segments)
    # Convert avg log-prob to approximate confidence (0-1)
    avg_logprob = -total / len(segments)
    confidence = max(0.0, min(1.0, 1.0 + avg_logprob))
    return round(confidence, 3)
