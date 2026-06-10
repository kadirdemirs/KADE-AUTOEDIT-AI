"""Declarative style presets for the Auto Edit orchestrator.

A style says *which* analysis modules to run, with *what* params, and how to
assemble their output into an EditPlan (zoom, captions, beat-snap, reframe,
render defaults). The orchestrator (modules/auto_edit.py) reads these — it
contains no per-style logic itself.
"""
from typing import Any, Dict, List, Tuple
from pydantic import BaseModel, Field


class CaptionStyle(BaseModel):
    enabled: bool = False
    font: str = "Arial"
    font_size: int = 64
    primary_color: str = "&H00FFFFFF"      # ASS BGR hex, white
    highlight_color: str = "&H0000F0FF"    # active-word highlight (yellow-ish)
    outline_color: str = "&H00000000"      # black
    outline: int = 3
    position: str = "bottom"               # "bottom" | "center" | "top"
    max_words: int = 4                     # words per caption line group
    uppercase: bool = True


class StyleConfig(BaseModel):
    id: str
    label: str
    description: str

    # Ordered list of (module_key, params). module_key maps to a runner in
    # the orchestrator's MODULE_RUNNERS table.
    modules: List[Tuple[str, Dict[str, Any]]] = Field(default_factory=list)

    zoom_enabled: bool = False
    snap_to_beat: bool = False
    target_ratio: str | None = None        # "9:16" | "1:1" | "16:9" | None
    apply_color: bool = False
    caption_style: CaptionStyle = Field(default_factory=CaptionStyle)

    render_defaults: Dict[str, Any] = Field(
        default_factory=lambda: {"burn_captions": True, "normalize_audio": True}
    )

    def public(self) -> Dict[str, Any]:
        """Panel-facing summary (no internal module wiring)."""
        return {
            "id": self.id,
            "label": self.label,
            "description": self.description,
            "zoom_enabled": self.zoom_enabled,
            "snap_to_beat": self.snap_to_beat,
            "target_ratio": self.target_ratio,
            "captions_enabled": self.caption_style.enabled,
            "modules": [m[0] for m in self.modules],
        }


# ── Presets ──────────────────────────────────────────────────────────────────

TALKING_HEAD = StyleConfig(
    id="talking_head",
    label="Talking Head",
    description="Tek kişi konuşma: boşlukları + dolgu kelimeleri at, dinamik zoom, "
                "kelime kelime animasyonlu altyazı, b-roll markerları.",
    modules=[
        ("silence", {"threshold_db": -38.0, "min_silence_ms": 350, "keep_padding_ms": 80}),
        ("transcript", {"detect_fillers": True}),
        ("zoom", {"min_scale": 1.12, "max_scale": 1.35, "sensitivity": 0.7}),
        ("captions", {"style": "youtube"}),
        ("broll", {"max_suggestions": 12}),
    ],
    zoom_enabled=True,
    caption_style=CaptionStyle(enabled=True, position="center", max_words=4, uppercase=True),
)

VIRAL_SHORT = StyleConfig(
    id="viral_short",
    label="Viral Short",
    description="Uzun videodan en iyi ~60s klibi çıkar, 9:16'ya reframe et, "
                "punch-in zoom + büyük animasyonlu altyazı.",
    modules=[
        ("viral", {"clip_duration": 60.0, "top_n": 1, "min_duration": 20.0}),
        ("silence", {"threshold_db": -38.0, "min_silence_ms": 300, "keep_padding_ms": 60}),
        ("resize", {}),
        ("zoom", {"min_scale": 1.15, "max_scale": 1.45, "sensitivity": 0.8}),
        ("captions", {"style": "tiktok"}),
    ],
    zoom_enabled=True,
    target_ratio="9:16",
    caption_style=CaptionStyle(enabled=True, position="center", font_size=80, max_words=3, uppercase=True),
)

BEAT_MONTAGE = StyleConfig(
    id="beat_montage",
    label="Beat Montage",
    description="Müziğe oturan hızlı kesimler: beat-sync + sahne tespiti, "
                "kesimleri beat'e snap'le.",
    modules=[
        ("beat", {"sensitivity": 0.85}),
        ("scene", {"threshold": 28.0, "min_scene_duration": 0.8}),
        ("zoom", {"min_scale": 1.1, "max_scale": 1.3, "sensitivity": 0.75}),
    ],
    zoom_enabled=True,
    snap_to_beat=True,
    render_defaults={"burn_captions": False, "normalize_audio": True},
)

PODCAST = StyleConfig(
    id="podcast",
    label="Podcast",
    description="Çoklu konuşmacı: konuşmacı segmentleri + boşluk temizliği + "
                "otomatik bölümler (chapters).",
    modules=[
        ("silence", {"threshold_db": -40.0, "min_silence_ms": 600, "keep_padding_ms": 120}),
        ("podcast", {"min_segment_duration": 1.0}),
        ("transcript", {"detect_fillers": True}),
        ("chapters", {"min_chapter_duration": 30.0, "max_chapters": 12}),
        ("captions", {"style": "youtube"}),
    ],
    caption_style=CaptionStyle(enabled=True, position="bottom", max_words=6, uppercase=False),
)

CINEMATIC = StyleConfig(
    id="cinematic",
    label="Cinematic",
    description="Yavaş tempo: sahne tespiti + renk grading + b-roll, altyazı yok.",
    modules=[
        ("scene", {"threshold": 35.0, "min_scene_duration": 2.0}),
        ("color", {}),
        ("broll", {"max_suggestions": 20}),
    ],
    apply_color=True,
    caption_style=CaptionStyle(enabled=False),
    render_defaults={"burn_captions": False, "normalize_audio": True},
)


ALL_STYLES: List[StyleConfig] = [
    TALKING_HEAD,
    VIRAL_SHORT,
    BEAT_MONTAGE,
    PODCAST,
    CINEMATIC,
]
