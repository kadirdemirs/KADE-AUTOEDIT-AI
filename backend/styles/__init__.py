from typing import Dict, List

from styles.presets import ALL_STYLES, StyleConfig, CaptionStyle

STYLES: Dict[str, StyleConfig] = {s.id: s for s in ALL_STYLES}


def get_style(style_id: str) -> StyleConfig:
    style = STYLES.get(style_id)
    if not style:
        raise KeyError(f"Unknown style '{style_id}'. Available: {', '.join(STYLES)}")
    return style


def list_styles() -> List[dict]:
    return [s.public() for s in ALL_STYLES]


__all__ = ["STYLES", "get_style", "list_styles", "StyleConfig", "CaptionStyle"]
