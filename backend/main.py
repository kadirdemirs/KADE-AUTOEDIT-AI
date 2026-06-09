import json
import time
import uuid
from contextlib import asynccontextmanager
from typing import List, Optional

import uvicorn
from fastapi import (
    Depends, FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from config import settings
from database import JobDB, PresetDB, get_db, init_db
from models.job import JobStatus, JobType
from models.preset import PresetCreate
from modules.silence_cutter import cut_silences
from modules.whisper_transcript import transcribe_audio
from modules.beat_sync import detect_beats
from modules.scene_detector import detect_scenes
from modules.auto_color import analyze_color_audio
from modules.auto_captions import generate_captions
from modules.auto_zoom import detect_zoom_points
from modules.viral_detector import detect_viral_segments
from modules.podcast_mode import detect_speakers
from modules.repeat_detector import detect_repeats
from modules.profanity_filter import filter_profanity
from modules.auto_chapters import generate_chapters
from modules.auto_resize import analyze_resize
from modules.broll_suggest import suggest_broll
from utils.ffmpeg_utils import get_video_info
from utils.file_utils import get_temp_path


# --- WebSocket connection manager ---
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helpers ---
def _get_job_or_404(job_id: str, db: Session) -> JobDB:
    job = db.query(JobDB).filter(JobDB.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


def _create_job(db: Session, job_type: str, input_file: str = None) -> JobDB:
    job = JobDB(
        id=str(uuid.uuid4()),
        status=JobStatus.PENDING.value,
        type=job_type,
        input_file=input_file,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


async def _run_job(job_id: str, job_type: str, coro, db: Session):
    """Execute a job coroutine, update DB, and broadcast progress."""
    start_time = time.time()

    # Mark processing
    job = _get_job_or_404(job_id, db)
    job.status = JobStatus.PROCESSING.value
    db.commit()
    await manager.broadcast({"event": "job_start", "job_id": job_id, "type": job_type})

    async def progress(pct: float, message: str):
        job = db.query(JobDB).filter(JobDB.id == job_id).first()
        if job:
            job.progress = str(round(pct * 100))
            db.commit()
        await manager.broadcast({
            "event": "progress",
            "job_id": job_id,
            "progress": round(pct * 100),
            "message": message,
        })

    try:
        result = await coro(progress_callback=progress)
        elapsed = round(time.time() - start_time, 2)

        job = _get_job_or_404(job_id, db)
        job.status = JobStatus.DONE.value
        job.output_data = result.model_dump_json() if hasattr(result, "model_dump_json") else json.dumps(result)
        job.progress = "100"
        db.commit()

        await manager.broadcast({
            "event": "job_done",
            "job_id": job_id,
            "type": job_type,
            "processing_time": elapsed,
        })
        return result
    except Exception as exc:
        job = _get_job_or_404(job_id, db)
        job.status = JobStatus.FAILED.value
        job.error_message = str(exc)
        db.commit()
        await manager.broadcast({
            "event": "job_failed",
            "job_id": job_id,
            "error": str(exc),
        })
        raise HTTPException(status_code=500, detail=str(exc))


# ── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"event": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# ── Analyze ───────────────────────────────────────────────────────────────────

@app.post("/analyze")
async def analyze_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        info = get_video_info(tmp_path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot analyze file: {exc}")

    return info


# ── Silence Cut ───────────────────────────────────────────────────────────────

@app.post("/silence-cut")
async def silence_cut(
    file: UploadFile = File(...),
    threshold_db: float = Form(settings.SILENCE_THRESHOLD),
    min_silence_ms: int = Form(500),
    fade_ms: int = Form(50),
    keep_padding_ms: int = Form(100),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    job = _create_job(db, JobType.SILENCE_CUT.value, tmp_path)

    async def run(progress_callback):
        return await cut_silences(
            tmp_path,
            threshold_db=threshold_db,
            min_silence_ms=min_silence_ms,
            fade_ms=fade_ms,
            keep_padding_ms=keep_padding_ms,
            progress_callback=progress_callback,
        )

    result = await _run_job(job.id, JobType.SILENCE_CUT.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Transcript ────────────────────────────────────────────────────────────────

@app.post("/transcript")
async def transcript(
    file: UploadFile = File(...),
    model_name: str = Form(settings.WHISPER_MODEL),
    language: str = Form(settings.WHISPER_LANGUAGE),
    detect_fillers: bool = Form(True),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    job = _create_job(db, JobType.TRANSCRIPT.value, tmp_path)

    async def run(progress_callback):
        return await transcribe_audio(
            tmp_path,
            model_name=model_name,
            language=language,
            detect_fillers=detect_fillers,
            progress_callback=progress_callback,
        )

    result = await _run_job(job.id, JobType.TRANSCRIPT.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Beat Sync ─────────────────────────────────────────────────────────────────

@app.post("/beat-sync")
async def beat_sync(
    file: UploadFile = File(...),
    sensitivity: float = Form(settings.BEAT_SENSITIVITY),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    job = _create_job(db, JobType.BEAT_SYNC.value, tmp_path)

    async def run(progress_callback):
        return await detect_beats(
            tmp_path,
            sensitivity=sensitivity,
            progress_callback=progress_callback,
        )

    result = await _run_job(job.id, JobType.BEAT_SYNC.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Scene Detect ──────────────────────────────────────────────────────────────

@app.post("/scene-detect")
async def scene_detect(
    file: UploadFile = File(...),
    threshold: float = Form(settings.SCENE_THRESHOLD),
    min_scene_duration: float = Form(1.0),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    job = _create_job(db, JobType.SCENE_DETECT.value, tmp_path)

    async def run(progress_callback):
        return await detect_scenes(
            tmp_path,
            threshold=threshold,
            min_scene_duration=min_scene_duration,
            progress_callback=progress_callback,
        )

    result = await _run_job(job.id, JobType.SCENE_DETECT.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Auto Color ────────────────────────────────────────────────────────────────

@app.post("/auto-color")
async def auto_color(
    file: UploadFile = File(...),
    target_lufs: float = Form(settings.TARGET_LUFS),
    lut_intensity: float = Form(1.0),
    denoise: bool = Form(False),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    job = _create_job(db, JobType.AUTO_COLOR.value, tmp_path)

    async def run(progress_callback):
        return await analyze_color_audio(
            tmp_path,
            target_lufs=target_lufs,
            lut_intensity=lut_intensity,
            denoise=denoise,
            progress_callback=progress_callback,
        )

    result = await _run_job(job.id, JobType.AUTO_COLOR.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Auto Captions ─────────────────────────────────────────────────────────────

@app.post("/auto-captions")
async def auto_captions(
    file: UploadFile = File(...),
    model_name: str = Form(settings.WHISPER_MODEL),
    language: str = Form(settings.WHISPER_LANGUAGE),
    style: str = Form("youtube"),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.AUTO_CAPTIONS.value, tmp_path)
    async def run(progress_callback):
        return await generate_captions(tmp_path, model_name=model_name, language=language, style=style, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.AUTO_CAPTIONS.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Auto Zoom ─────────────────────────────────────────────────────────────────

@app.post("/auto-zoom")
async def auto_zoom(
    file: UploadFile = File(...),
    min_scale: float = Form(1.15),
    max_scale: float = Form(1.40),
    sensitivity: float = Form(0.7),
    zoom_duration: float = Form(0.3),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.AUTO_ZOOM.value, tmp_path)
    async def run(progress_callback):
        return await detect_zoom_points(tmp_path, min_scale=min_scale, max_scale=max_scale, sensitivity=sensitivity, zoom_duration=zoom_duration, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.AUTO_ZOOM.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Viral Detect ──────────────────────────────────────────────────────────────

@app.post("/viral-detect")
async def viral_detect(
    file: UploadFile = File(...),
    clip_duration: float = Form(60.0),
    top_n: int = Form(3),
    min_duration: float = Form(20.0),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.VIRAL_DETECT.value, tmp_path)
    async def run(progress_callback):
        return await detect_viral_segments(tmp_path, clip_duration=clip_duration, top_n=top_n, min_duration=min_duration, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.VIRAL_DETECT.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Podcast Mode ──────────────────────────────────────────────────────────────

@app.post("/podcast-mode")
async def podcast_mode(
    file: UploadFile = File(...),
    min_segment_duration: float = Form(1.0),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.PODCAST_MODE.value, tmp_path)
    async def run(progress_callback):
        return await detect_speakers(tmp_path, min_segment_duration=min_segment_duration, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.PODCAST_MODE.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Repeat Detect ─────────────────────────────────────────────────────────────

@app.post("/repeat-detect")
async def repeat_detect(
    file: UploadFile = File(...),
    model_name: str = Form(settings.WHISPER_MODEL),
    language: str = Form(settings.WHISPER_LANGUAGE),
    similarity_threshold: float = Form(0.65),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.REPEAT_DETECT.value, tmp_path)
    async def run(progress_callback):
        return await detect_repeats(tmp_path, model_name=model_name, language=language, similarity_threshold=similarity_threshold, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.REPEAT_DETECT.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Profanity Filter ──────────────────────────────────────────────────────────

@app.post("/profanity-filter")
async def profanity_filter(
    file: UploadFile = File(...),
    model_name: str = Form(settings.WHISPER_MODEL),
    language: str = Form(settings.WHISPER_LANGUAGE),
    replacement: str = Form("bleep"),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.PROFANITY_FILTER.value, tmp_path)
    async def run(progress_callback):
        return await filter_profanity(tmp_path, model_name=model_name, language=language, replacement=replacement, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.PROFANITY_FILTER.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Auto Chapters ─────────────────────────────────────────────────────────────

@app.post("/auto-chapters")
async def auto_chapters(
    file: UploadFile = File(...),
    model_name: str = Form(settings.WHISPER_MODEL),
    language: str = Form(settings.WHISPER_LANGUAGE),
    min_chapter_duration: float = Form(30.0),
    max_chapters: int = Form(12),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.AUTO_CHAPTERS.value, tmp_path)
    async def run(progress_callback):
        return await generate_chapters(tmp_path, model_name=model_name, language=language, min_chapter_duration=min_chapter_duration, max_chapters=max_chapters, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.AUTO_CHAPTERS.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Auto Resize ───────────────────────────────────────────────────────────────

@app.post("/auto-resize")
async def auto_resize(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.AUTO_RESIZE.value, tmp_path)
    async def run(progress_callback):
        return await analyze_resize(tmp_path, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.AUTO_RESIZE.value, run, db)
    return {"job_id": job.id, "result": result}


# ── B-Roll Suggest ────────────────────────────────────────────────────────────

@app.post("/broll-suggest")
async def broll_suggest(
    file: UploadFile = File(...),
    model_name: str = Form(settings.WHISPER_MODEL),
    language: str = Form(settings.WHISPER_LANGUAGE),
    min_duration: float = Form(2.0),
    max_suggestions: int = Form(20),
    db: Session = Depends(get_db),
):
    tmp_path = get_temp_path(suffix=f"_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = _create_job(db, JobType.BROLL_SUGGEST.value, tmp_path)
    async def run(progress_callback):
        return await suggest_broll(tmp_path, model_name=model_name, language=language, min_duration=min_duration, max_suggestions=max_suggestions, progress_callback=progress_callback)
    result = await _run_job(job.id, JobType.BROLL_SUGGEST.value, run, db)
    return {"job_id": job.id, "result": result}


# ── Jobs CRUD ─────────────────────────────────────────────────────────────────

@app.get("/jobs")
async def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(JobDB).order_by(JobDB.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "status": j.status,
            "type": j.type,
            "progress": float(j.progress or 0),
            "input_file": j.input_file,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, db: Session = Depends(get_db)):
    job = _get_job_or_404(job_id, db)
    output = None
    if job.output_data:
        try:
            output = json.loads(job.output_data)
        except Exception:
            output = job.output_data
    return {
        "id": job.id,
        "status": job.status,
        "type": job.type,
        "progress": job.progress,
        "output_data": output,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = _get_job_or_404(job_id, db)
    db.delete(job)
    db.commit()
    return {"deleted": job_id}


# ── Presets CRUD ──────────────────────────────────────────────────────────────

@app.get("/presets")
async def list_presets(db: Session = Depends(get_db)):
    presets = db.query(PresetDB).order_by(PresetDB.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "module": p.module,
            "settings": json.loads(p.settings_json),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in presets
    ]


@app.post("/presets")
async def create_preset(preset: PresetCreate, db: Session = Depends(get_db)):
    p = PresetDB(
        id=str(uuid.uuid4()),
        name=preset.name,
        module=preset.module,
        settings_json=json.dumps(preset.settings),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "module": p.module}


@app.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str, db: Session = Depends(get_db)):
    preset = db.query(PresetDB).filter(PresetDB.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail=f"Preset {preset_id} not found")
    db.delete(preset)
    db.commit()
    return {"deleted": preset_id}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
