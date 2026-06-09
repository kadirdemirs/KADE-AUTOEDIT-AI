import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from config import settings


def ensure_dir(path: str) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_temp_path(suffix: str = ".tmp", prefix: str = "kade_") -> str:
    filename = f"{prefix}{uuid.uuid4().hex}{suffix}"
    return str(settings.TEMP_DIR / filename)


def get_output_path(original_filename: str, suffix: str = "_output", ext: str = None) -> str:
    stem = Path(original_filename).stem
    extension = ext or Path(original_filename).suffix
    filename = f"{stem}{suffix}{extension}"
    return str(settings.OUTPUT_DIR / filename)


def cleanup_temp(path: str) -> bool:
    try:
        p = Path(path)
        if p.is_file():
            p.unlink()
        elif p.is_dir():
            shutil.rmtree(p)
        return True
    except Exception:
        return False


def cleanup_old_temp_files(max_age_hours: int = 24):
    """Remove temp files older than max_age_hours."""
    import time
    now = time.time()
    cutoff = now - (max_age_hours * 3600)
    for f in settings.TEMP_DIR.iterdir():
        if f.stat().st_mtime < cutoff:
            try:
                f.unlink()
            except Exception:
                pass


def get_file_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except Exception:
        return 0


def safe_filename(name: str) -> str:
    """Sanitize filename to remove dangerous characters."""
    return "".join(c for c in name if c.isalnum() or c in "._- ").strip()
