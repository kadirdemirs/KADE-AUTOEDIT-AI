"""Meme finder — konuya veya yazıya göre meme önerir (TR/EN).

Üç kaynak, her biri opsiyonel:
  - generated : offline impact-font üst/alt yazılı meme (PIL, API'siz)
  - imgflip   : popüler şablon arşivinden caption'lı meme (kullanıcı/şifre)
  - tenor     : GIF arama (API anahtarı)
  - giphy     : GIF arama (API anahtarı)

İki mod:
  - text       : kullanıcının girdiği yazı/konu
  - transcript : videoyu transkript edip vurgulu/komik anlara meme önerir
"""
import asyncio
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable, Dict, List, Optional

from config import settings
from models.result import MemeResult, MemeSuggestion
from utils.ffmpeg_utils import extract_audio


_STOPWORDS = {
    "bir", "bu", "o", "ve", "de", "da", "ki", "ile", "için", "var", "yok",
    "gibi", "kadar", "ama", "çok", "daha", "olan", "ben", "sen", "biz",
    "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "is", "are",
    "was", "it", "this", "that", "i", "you", "we", "they", "have", "do", "not",
    "of", "with", "as", "but", "so", "if", "my", "your",
}

# Anlar: meme'e uygun "vurgu/komik/şaşkınlık" tetikleyici kalıpları
_MEME_TRIGGERS = [
    r"\b(inanılmaz|şok|çılgın|komik|saçma|berbat|efsane|rezalet|işte bu|aynen|valla)\b",
    r"\b(crazy|insane|shock|wow|omg|hilarious|literally|honestly|exactly|no way|bruh)\b",
]


def _looks_turkish(text: str) -> bool:
    return bool(re.search(r"[ğüşıöçĞÜŞİÖÇ]", text)) or any(
        w in text.lower().split() for w in ("ve", "bir", "bu", "için", "çok")
    )


def _keywords(text: str, n: int = 3) -> List[str]:
    words = re.findall(r"\b[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}\b", text.lower())
    out, seen = [], set()
    for w in words:
        if w in _STOPWORDS or w in seen:
            continue
        seen.add(w)
        out.append(w)
        if len(out) >= n:
            break
    return out


async def find_memes(
    *,
    text: Optional[str] = None,
    video_path: Optional[str] = None,
    model_name: str = None,
    language: str = None,
    sources: Optional[List[str]] = None,
    max_results: int = 12,
    generate: bool = True,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> MemeResult:
    sources = sources or ["generated", "imgflip", "tenor", "giphy"]
    mode = "transcript" if video_path else "text"

    async def progress(p, m):
        if progress_callback:
            await progress_callback(p, m)

    # 1) Toplanacak (query, timestamp) çiftlerini belirle
    await progress(0.05, "Konu/yazı çözümleniyor...")
    topics = await _collect_topics(text, video_path, model_name, language, progress)

    # 2) Her kaynaktan öneri topla
    suggestions: List[MemeSuggestion] = []
    used: List[str] = []
    loop = asyncio.get_event_loop()

    for i, (query, ts) in enumerate(topics):
        lang = "tr" if _looks_turkish(query) else "en"
        kws = _keywords(query)

        if "generated" in sources and generate:
            sug = await loop.run_in_executor(None, lambda q=query, l=lang, k=kws, t=ts: _generate_meme(q, l, k, t))
            if sug:
                suggestions.append(sug)
                if "generated" not in used:
                    used.append("generated")

        for api_src in ("imgflip", "tenor", "giphy"):
            if api_src in sources:
                items = await loop.run_in_executor(None, lambda s=api_src, q=query, l=lang, k=kws, t=ts: _fetch_api(s, q, l, k, t))
                if items:
                    suggestions.extend(items)
                    if api_src not in used:
                        used.append(api_src)

        await progress(0.2 + 0.7 * (i + 1) / max(1, len(topics)), f"Meme aranıyor: {query[:30]}")

    suggestions.sort(key=lambda s: s.score, reverse=True)
    suggestions = suggestions[:max_results]

    await progress(1.0, "Meme önerileri hazır.")
    return MemeResult(
        suggestions=suggestions,
        total=len(suggestions),
        mode=mode,
        sources_used=used,
    )


async def _collect_topics(text, video_path, model_name, language, progress) -> List:
    """Return list of (query, timestamp_or_None)."""
    if text:
        # Tek serbest metin → kendisi + anahtar kelimeleri
        return [(text.strip(), None)]

    if not video_path:
        # Ne yazı ne video — aranacak konu yok.
        return []

    # transcript modu
    model_name = model_name or settings.WHISPER_MODEL
    language = language or settings.WHISPER_LANGUAGE
    await progress(0.1, "Ses çıkarılıyor...")
    loop = asyncio.get_event_loop()
    audio_path = await loop.run_in_executor(None, extract_audio, video_path)
    await progress(0.15, f"Transkript ({model_name})...")
    raw = await loop.run_in_executor(None, lambda: _run_whisper(audio_path, model_name, language))

    topics = []
    for seg in raw.get("segments", []):
        seg_text = (seg.get("text") or "").strip()
        if not seg_text:
            continue
        low = seg_text.lower()
        if any(re.search(p, low) for p in _MEME_TRIGGERS):
            topics.append((seg_text, round(float(seg.get("start", 0)), 2)))
    # Tetikleyici yoksa en uzun birkaç segmenti al
    if not topics:
        segs = sorted(raw.get("segments", []), key=lambda s: len(s.get("text", "")), reverse=True)
        topics = [((s.get("text") or "").strip(), round(float(s.get("start", 0)), 2)) for s in segs[:5]]
    return topics[:8]


def _run_whisper(audio_path: str, model_name: str, language: str) -> dict:
    import whisper
    model = whisper.load_model(model_name)
    return model.transcribe(audio_path, language=language, verbose=False)


# ── Offline meme üretimi (PIL) ──────────────────────────────────────────────────

def _split_caption(text: str) -> tuple:
    """Bir konuyu üst/alt meme yazısına böl."""
    words = text.upper().split()
    if len(words) <= 2:
        return text.upper(), ""
    mid = len(words) // 2
    return " ".join(words[:mid]), " ".join(words[mid:])


def _generate_meme(query: str, lang: str, kws: List[str], ts) -> Optional[MemeSuggestion]:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return None

    W, H = 800, 800
    img = Image.new("RGB", (W, H), (20, 20, 20))
    draw = ImageDraw.Draw(img)
    # Basit bir arka plan (degrade his) — şablon görseli yoksa düz renk meme.
    for y in range(H):
        shade = int(20 + 30 * (y / H))
        draw.line([(0, y), (W, y)], fill=(shade, shade, shade + 10))

    top, bottom = _split_caption(query)

    def _font(size: int):
        for name in ("impact.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf", "Arial.ttf"):
            try:
                return ImageFont.truetype(name, size)
            except Exception:
                continue
        return ImageFont.load_default()

    font = _font(56)

    def _draw_outlined(text, y):
        if not text:
            return
        # ortala
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        x = (W - tw) // 2
        for dx in (-3, 0, 3):
            for dy in (-3, 0, 3):
                draw.text((x + dx, y + dy), text, font=font, fill=(0, 0, 0))
        draw.text((x, y), text, font=font, fill=(255, 255, 255))

    _draw_outlined(top, 30)
    _draw_outlined(bottom, H - 90)

    out_dir = settings.OUTPUT_DIR / "memes"
    out_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", query.lower())[:40] or "meme"
    path = out_dir / f"{safe}.png"
    img.save(path)

    return MemeSuggestion(
        source="generated",
        title=query[:60],
        local_path=str(path),
        media_type="image",
        query=query,
        top_text=top,
        bottom_text=bottom,
        keywords=kws,
        language=lang,
        score=0.55,
        placement=ts,
    )


# ── API kaynakları (opsiyonel, stdlib urllib ile) ──────────────────────────────

def _http_json(url: str, data: bytes = None, timeout: int = 10) -> Optional[dict]:
    try:
        req = urllib.request.Request(url, data=data, headers={"User-Agent": "kade-autoedit"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def _fetch_api(source: str, query: str, lang: str, kws: List[str], ts) -> List[MemeSuggestion]:
    if source == "imgflip":
        return _fetch_imgflip(query, lang, kws, ts)
    if source == "tenor":
        return _fetch_tenor(query, lang, kws, ts)
    if source == "giphy":
        return _fetch_giphy(query, lang, kws, ts)
    return []


def _fetch_imgflip(query: str, lang: str, kws: List[str], ts) -> List[MemeSuggestion]:
    # Imgflip get_memes API anahtarsızdır; arama yapıp en alakalı şablonu döndür.
    data = _http_json("https://api.imgflip.com/get_memes")
    if not data or not data.get("success"):
        return []
    memes = data["data"]["memes"]
    q = query.lower()
    scored = []
    for m in memes:
        name = m.get("name", "").lower()
        overlap = sum(1 for k in kws if k in name)
        if overlap or any(w in name for w in q.split()):
            scored.append((overlap, m))
    scored.sort(key=lambda x: x[0], reverse=True)
    out = []
    for overlap, m in (scored[:2] or [(0, memes[0])]):
        out.append(MemeSuggestion(
            source="imgflip", title=m.get("name", ""), url=m.get("url"),
            media_type="image", query=query, keywords=kws, language=lang,
            score=0.5 + 0.1 * overlap, placement=ts,
        ))
    return out


def _fetch_tenor(query: str, lang: str, kws: List[str], ts) -> List[MemeSuggestion]:
    key = settings.TENOR_API_KEY
    if not key:
        return []
    qs = urllib.parse.urlencode({
        "q": query, "key": key, "limit": 2,
        "locale": "tr_TR" if lang == "tr" else "en_US", "media_filter": "gif",
    })
    data = _http_json(f"https://tenor.googleapis.com/v2/search?{qs}")
    if not data:
        return []
    out = []
    for r in data.get("results", [])[:2]:
        media = r.get("media_formats", {}).get("gif", {})
        out.append(MemeSuggestion(
            source="tenor", title=r.get("content_description", query),
            url=media.get("url"), media_type="gif", query=query,
            keywords=kws, language=lang, score=0.6, placement=ts,
        ))
    return out


def _fetch_giphy(query: str, lang: str, kws: List[str], ts) -> List[MemeSuggestion]:
    key = settings.GIPHY_API_KEY
    if not key:
        return []
    qs = urllib.parse.urlencode({
        "q": query, "api_key": key, "limit": 2,
        "lang": "tr" if lang == "tr" else "en",
    })
    data = _http_json(f"https://api.giphy.com/v1/gifs/search?{qs}")
    if not data:
        return []
    out = []
    for r in data.get("data", [])[:2]:
        url = r.get("images", {}).get("original", {}).get("url")
        out.append(MemeSuggestion(
            source="giphy", title=r.get("title", query) or query,
            url=url, media_type="gif", query=query,
            keywords=kws, language=lang, score=0.6, placement=ts,
        ))
    return out
