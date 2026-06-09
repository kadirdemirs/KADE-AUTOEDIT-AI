import asyncio
from typing import Callable, List, Optional

from models.result import AutoResizeResult, ResizeFormat


FORMATS = [
    {"name": "9:16 (TikTok / Reels)", "ratio_w": 9,  "ratio_h": 16},
    {"name": "1:1 (Instagram Kare)", "ratio_w": 1,  "ratio_h": 1},
    {"name": "4:5 (Instagram Dikey)", "ratio_w": 4,  "ratio_h": 5},
    {"name": "16:9 (YouTube)",        "ratio_w": 16, "ratio_h": 9},
    {"name": "4:3 (Classic)",         "ratio_w": 4,  "ratio_h": 3},
]


async def analyze_resize(
    video_path: str,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> AutoResizeResult:
    if progress_callback:
        await progress_callback(0.1, "Analyzing video frame...")

    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _compute_reframe(video_path)
    )

    if progress_callback:
        await progress_callback(1.0, "Resize analysis done.")

    return result


def _compute_reframe(video_path: str) -> AutoResizeResult:
    import cv2
    import numpy as np

    cap = cv2.VideoCapture(str(video_path))
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Detect face / subject center from sampled frames
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    cx_list, cy_list = [], []
    samples = min(10, frame_count)
    step = max(1, frame_count // samples)

    for i in range(0, frame_count, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4)
        if len(faces) > 0:
            # Use largest face
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            cx_list.append((x + w / 2) / orig_w)
            cy_list.append((y + h / 2) / orig_h)

    cap.release()

    subject_detected = len(cx_list) > 0
    # Default: center of frame if no face found
    cx = float(np.median(cx_list)) if cx_list else 0.5
    cy = float(np.median(cy_list)) if cy_list else 0.4  # slightly above center

    formats = _compute_crops(orig_w, orig_h, cx, cy)

    return AutoResizeResult(
        original_resolution=f"{orig_w}x{orig_h}",
        formats=formats,
        subject_detected=subject_detected,
        subject_center_x=round(cx, 4),
        subject_center_y=round(cy, 4),
    )


def _compute_crops(orig_w: int, orig_h: int, cx: float, cy: float) -> List[ResizeFormat]:
    formats: List[ResizeFormat] = []

    for fmt in FORMATS:
        rw, rh = fmt["ratio_w"], fmt["ratio_h"]
        target_ratio = rw / rh
        orig_ratio = orig_w / orig_h

        if target_ratio < orig_ratio:
            # Crop width
            crop_h = orig_h
            crop_w = int(orig_h * target_ratio)
        else:
            # Crop height
            crop_w = orig_w
            crop_h = int(orig_w / target_ratio)

        # Center crop on subject
        crop_x_px = int(cx * orig_w - crop_w / 2)
        crop_y_px = int(cy * orig_h - crop_h / 2)

        # Clamp to valid range
        crop_x_px = max(0, min(crop_x_px, orig_w - crop_w))
        crop_y_px = max(0, min(crop_y_px, orig_h - crop_h))

        scale = orig_w / crop_w

        formats.append(ResizeFormat(
            name=fmt["name"],
            ratio_w=rw,
            ratio_h=rh,
            crop_x=round(crop_x_px / orig_w, 4),
            crop_y=round(crop_y_px / orig_h, 4),
            crop_width=round(crop_w / orig_w, 4),
            crop_height=round(crop_h / orig_h, 4),
            scale=round(scale, 4),
        ))

    return formats
