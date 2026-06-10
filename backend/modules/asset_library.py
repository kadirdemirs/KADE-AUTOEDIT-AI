from pathlib import Path
from typing import Dict, List, Optional

from config import settings


CATEGORIES = [
    {
        "id": "transitions",
        "label": "Transitions",
        "description": "Seamless, cinematic and social transitions for fast timeline assembly.",
        "icon": "↔",
    },
    {
        "id": "media-animations",
        "label": "Media Animations",
        "description": "One-click image and video motion presets, reveals and screen moves.",
        "icon": "▣",
    },
    {
        "id": "templates",
        "label": "Templates",
        "description": "Reusable edit layouts, callouts, openers and creator-style building blocks.",
        "icon": "▤",
    },
    {
        "id": "titles-lower-thirds",
        "label": "Titles & Lower Thirds",
        "description": "MOGRT title cards, lower thirds, name straps and animated labels.",
        "icon": "T",
    },
    {
        "id": "social-media",
        "label": "Social Media",
        "description": "Subscribe prompts, like buttons, comments, stories and platform overlays.",
        "icon": "#",
    },
    {
        "id": "typography",
        "label": "Typography",
        "description": "Animated text presets, captions, kinetic type and word emphasis looks.",
        "icon": "Aa",
    },
    {
        "id": "gaming-elements",
        "label": "Gaming Elements",
        "description": "HUDs, stream overlays, hit markers, alerts and energetic game assets.",
        "icon": "🎮",
    },
    {
        "id": "color-presets",
        "label": "Color Presets",
        "description": "LUTs and color looks for cinematic, creator and clean commercial grades.",
        "icon": "◐",
    },
    {
        "id": "effects-overlays",
        "label": "Effects & Overlays",
        "description": "Light leaks, grain, glitches, wipes, frame overlays and texture passes.",
        "icon": "✦",
    },
    {
        "id": "text-presets-mogrt",
        "label": "Text Presets - MOGRT",
        "description": "Editable motion graphics text presets ready to insert at the playhead.",
        "icon": "M",
    },
    {
        "id": "logo-intros",
        "label": "Logo Intros",
        "description": "Logo reveals, brand stings and short intro/outro animation templates.",
        "icon": "◇",
    },
    {
        "id": "stories",
        "label": "Stories",
        "description": "Vertical story layouts, reels frames and short-form composition kits.",
        "icon": "▯",
    },
    {
        "id": "devices",
        "label": "Devices",
        "description": "Phone, laptop, tablet and browser mockups for product/social edits.",
        "icon": "▭",
    },
    {
        "id": "messages",
        "label": "Messages",
        "description": "Chat bubbles, DM overlays, comment threads and notification assets.",
        "icon": "…",
    },
]

CATEGORY_IDS = {category["id"] for category in CATEGORIES}

EXTENSION_KIND = {
    ".mogrt": "mogrt",
    ".mp4": "video",
    ".mov": "video",
    ".m4v": "video",
    ".webm": "video",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".gif": "image",
    ".wav": "audio",
    ".mp3": "audio",
    ".aif": "audio",
    ".aiff": "audio",
    ".m4a": "audio",
    ".cube": "lut",
    ".look": "lut",
    ".prfpset": "preset",
}


def list_categories() -> List[Dict[str, str]]:
    return CATEGORIES


def list_assets(category: Optional[str] = None, query: str = "") -> List[Dict[str, object]]:
    root = settings.ASSET_LIBRARY_DIR.resolve()
    root.mkdir(parents=True, exist_ok=True)
    normalized_query = query.strip().lower()
    assets: List[Dict[str, object]] = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        kind = EXTENSION_KIND.get(ext)
        if not kind:
            continue

        rel = path.relative_to(root)
        category_id = _category_for(rel)
        if category and category != "all" and category_id != category:
            continue

        title = _titleize(path.stem)
        haystack = f"{title} {category_id} {kind} {path.name}".lower()
        if normalized_query and normalized_query not in haystack:
            continue

        assets.append(
            {
                "id": str(rel).replace("\\", "/"),
                "title": title,
                "category": category_id,
                "kind": kind,
                "path": str(path),
                "extension": ext.lstrip("."),
                "size_bytes": path.stat().st_size,
                "description": _description_for(kind, category_id),
                "tags": _tags_for(path, category_id, kind),
            }
        )

    assets.sort(key=lambda item: (str(item["category"]), str(item["title"]).lower()))
    return assets


def _category_for(relative_path: Path) -> str:
    first = relative_path.parts[0].lower() if relative_path.parts else "templates"
    normalized = first.replace("_", "-").replace(" ", "-")
    return normalized if normalized in CATEGORY_IDS else "templates"


def _titleize(stem: str) -> str:
    cleaned = stem.replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in cleaned.split()) or stem


def _tags_for(path: Path, category: str, kind: str) -> List[str]:
    parts = [category, kind]
    parts.extend(token.lower() for token in path.stem.replace("_", "-").split("-") if token)
    return sorted(set(parts))


def _description_for(kind: str, category: str) -> str:
    if kind == "mogrt":
        return "Editable MOGRT template. Insert at playhead, then customize text and controls in Essential Graphics."
    if kind == "video":
        return "Video asset. Import to project or place on timeline as overlay/b-roll."
    if kind == "image":
        return "Image/overlay asset. Import to project and layer over your edit."
    if kind == "audio":
        return "Audio asset. Import to project for whooshes, hits, ambience or music cues."
    if kind == "lut":
        return "Color look file. Use with Lumetri or the color workflow."
    if kind == "preset":
        return "Premiere preset file. Import/apply through Premiere preset workflows."
    return f"{category} asset."
