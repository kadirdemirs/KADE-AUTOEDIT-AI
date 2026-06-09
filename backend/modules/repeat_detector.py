import asyncio
from typing import Callable, List, Optional

from models.result import CutPoint, RepeatDetectResult, RepeatGroup, RepeatSegment
from utils.ffmpeg_utils import extract_audio


async def detect_repeats(
    video_path: str,
    model_name: str = None,
    language: str = None,
    similarity_threshold: float = 0.65,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> RepeatDetectResult:
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
        await progress_callback(0.6, "Finding repeated takes...")

    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _find_repeats(raw, audio_path, similarity_threshold)
    )

    if progress_callback:
        await progress_callback(1.0, "Done.")

    return result


def _run_whisper(audio_path: str, model_name: str, language: str) -> dict:
    import whisper
    model = whisper.load_model(model_name)
    return model.transcribe(audio_path, language=language, word_timestamps=True, verbose=False)


def _text_similarity(a: str, b: str) -> float:
    """Simple Jaccard similarity on word sets."""
    wa = set(a.lower().split())
    wb = set(b.lower().split())
    if not wa or not wb:
        return 0.0
    intersection = wa & wb
    union = wa | wb
    return len(intersection) / len(union)


def _segment_rms(audio_path: str, start: float, end: float) -> float:
    import numpy as np
    import soundfile as sf
    data, sr = sf.read(audio_path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    s = int(start * sr)
    e = int(end * sr)
    chunk = data[s:e]
    if len(chunk) == 0:
        return 0.0
    return float(np.sqrt(np.mean(chunk.astype(np.float64) ** 2)))


def _find_repeats(raw: dict, audio_path: str, threshold: float) -> RepeatDetectResult:
    segments = raw.get("segments", [])
    if not segments:
        return RepeatDetectResult(groups=[], total_groups=0, cuts_suggested=[], time_saved=0.0)

    # Convert to simple list
    segs = [
        {
            "text": s.get("text", "").strip(),
            "start": float(s.get("start", 0)),
            "end": float(s.get("end", 0)),
        }
        for s in segments
        if s.get("text", "").strip()
    ]

    used = [False] * len(segs)
    groups: List[RepeatGroup] = []
    cuts: List[CutPoint] = []
    total_saved = 0.0

    for i in range(len(segs)):
        if used[i]:
            continue
        group_items = [i]

        for j in range(i + 1, len(segs)):
            if used[j]:
                continue
            sim = _text_similarity(segs[i]["text"], segs[j]["text"])
            if sim >= threshold:
                group_items.append(j)
                used[j] = True

        if len(group_items) < 2:
            continue

        used[i] = True

        # Score each take by RMS (louder/clearer = better)
        repeat_segs: List[RepeatSegment] = []
        for idx in group_items:
            s = segs[idx]
            rms = _segment_rms(audio_path, s["start"], s["end"])
            repeat_segs.append(RepeatSegment(
                start=round(s["start"], 3),
                end=round(s["end"], 3),
                text=s["text"],
                rms_score=round(rms, 6),
                is_best_take=False,
            ))

        best_idx = max(range(len(repeat_segs)), key=lambda k: repeat_segs[k].rms_score)
        repeat_segs[best_idx] = repeat_segs[best_idx].model_copy(update={"is_best_take": True})

        group = RepeatGroup(
            group_id=len(groups) + 1,
            segments=repeat_segs,
            best_take=repeat_segs[best_idx],
        )
        groups.append(group)

        # Suggest cutting all non-best takes
        for k, seg in enumerate(repeat_segs):
            if not seg.is_best_take:
                cuts.append(CutPoint(
                    start=seg.start,
                    end=seg.end,
                    type="cut",
                    label=f"repeat_group_{group.group_id}",
                    confidence=0.8,
                ))
                total_saved += seg.end - seg.start

    return RepeatDetectResult(
        groups=groups,
        total_groups=len(groups),
        cuts_suggested=cuts,
        time_saved=round(total_saved, 2),
    )
