import asyncio
from typing import Callable, Optional

from config import settings
from models.result import Scene, SceneDetectResult


async def detect_scenes(
    video_path: str,
    threshold: float = None,
    min_scene_duration: float = 1.0,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> SceneDetectResult:
    threshold = threshold if threshold is not None else settings.SCENE_THRESHOLD

    if progress_callback:
        await progress_callback(0.1, "Starting scene detection...")

    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _run_scene_detection(video_path, threshold, min_scene_duration)
    )

    if progress_callback:
        await progress_callback(1.0, "Scene detection complete.")

    return result


def _run_scene_detection(
    video_path: str,
    threshold: float,
    min_scene_duration: float,
) -> SceneDetectResult:
    try:
        # PySceneDetect 0.6.x new API
        from scenedetect import open_video, SceneManager
        from scenedetect.detectors import ContentDetector

        video = open_video(str(video_path))
        scene_manager = SceneManager()
        scene_manager.add_detector(
            ContentDetector(threshold=threshold, min_scene_len=int(min_scene_duration * 25))
        )
        scene_manager.detect_scenes(video)
        scene_list = scene_manager.get_scene_list()
    except ImportError:
        # Fallback to legacy VideoManager API (0.5.x)
        from scenedetect import VideoManager, SceneManager
        from scenedetect.detectors import ContentDetector

        video_manager = VideoManager([str(video_path)])
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=threshold, min_scene_len=int(min_scene_duration * 25)))
        video_manager.set_downscale_factor()
        video_manager.start()
        try:
            scene_manager.detect_scenes(frame_source=video_manager)
        finally:
            video_manager.release()
        scene_list = scene_manager.get_scene_list()

    scenes = []
    for scene_start, scene_end in scene_list:
        start_sec = scene_start.get_seconds()
        end_sec = scene_end.get_seconds()
        duration = end_sec - start_sec

        if duration < min_scene_duration:
            continue

        # Content score is not directly available — use duration as proxy
        score = min(100.0, duration * 10)

        scenes.append(Scene(
            start=round(start_sec, 3),
            end=round(end_sec, 3),
            score=round(score, 2),
            frame_start=scene_start.get_frames(),
            frame_end=scene_end.get_frames(),
        ))

    avg_duration = (
        sum(s.end - s.start for s in scenes) / len(scenes) if scenes else 0.0
    )

    return SceneDetectResult(
        scenes=scenes,
        total_scenes=len(scenes),
        avg_scene_duration=round(avg_duration, 3),
    )
