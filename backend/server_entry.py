"""Frozen-app entry point for the KADE AutoEdit backend.

Launched by the packaged executable (PyInstaller). Starts the FastAPI app with
uvicorn, opens the panel-facing port, and keeps a small console with status.
For development just run `python main.py` instead.
"""
import sys
from pathlib import Path

# When frozen, the working dir is unpredictable; make sure local imports resolve.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn  # noqa: E402

from config import settings  # noqa: E402
from main import app  # noqa: E402  (import the ASGI app object directly)


def main() -> None:
    print("=" * 48)
    print(f" {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f" Sunucu: http://localhost:{settings.PORT}")
    print(f" FFmpeg: {settings.FFMPEG_PATH}")
    print(" Bu pencereyi kapatmak sunucuyu durdurur.")
    print("=" * 48)

    # Bind to loopback for the local panel. 0.0.0.0 is unnecessary for a desktop app.
    host = "127.0.0.1"
    uvicorn.run(app, host=host, port=settings.PORT, reload=False, log_level="info")


if __name__ == "__main__":
    main()
