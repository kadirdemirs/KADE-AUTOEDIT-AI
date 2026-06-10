"""Download static ffmpeg + ffprobe binaries for the current platform.

Places them under packaging/bin/<os>/ so the PyInstaller spec can bundle them.
Run once before building the installer:  python packaging/fetch_ffmpeg.py
"""
import io
import os
import platform
import shutil
import stat
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Static build sources per platform. These are widely used static FFmpeg builds.
SOURCES = {
    "windows": {
        "url": "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        "archive": "zip",
        "members": {"ffmpeg.exe": "bin/ffmpeg.exe", "ffprobe.exe": "bin/ffprobe.exe"},
    },
    # macOS: evermeet.cx ships separate zip archives per tool (universal/arm64).
    "macos": {
        "tools": {
            "ffmpeg": "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip",
            "ffprobe": "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip",
        },
        "archive": "zip-per-tool",
    },
    "linux": {
        "url": "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
        "archive": "tar",
        "members": {"ffmpeg": "ffmpeg", "ffprobe": "ffprobe"},
    },
}


def _os_key() -> str:
    if sys.platform == "win32":
        return "windows"
    if sys.platform == "darwin":
        return "macos"
    return "linux"


def _download(url: str) -> bytes:
    print(f"  indiriliyor: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "kade-autoedit-build"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return resp.read()


def _make_executable(path: Path) -> None:
    if os.name != "nt":
        path.chmod(path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


def fetch_windows(out: Path, cfg: dict) -> None:
    data = _download(cfg["url"])
    zf = zipfile.ZipFile(io.BytesIO(data))
    for want, suffix in cfg["members"].items():
        member = next(n for n in zf.namelist() if n.endswith(suffix))
        with zf.open(member) as src, open(out / want, "wb") as dst:
            shutil.copyfileobj(src, dst)
        print(f"  yazildi: {out / want}")


def fetch_macos(out: Path, cfg: dict) -> None:
    for tool, url in cfg["tools"].items():
        data = _download(url)
        zf = zipfile.ZipFile(io.BytesIO(data))
        member = next(n for n in zf.namelist() if n.endswith(tool))
        with zf.open(member) as src, open(out / tool, "wb") as dst:
            shutil.copyfileobj(src, dst)
        _make_executable(out / tool)
        print(f"  yazildi: {out / tool}")


def fetch_linux(out: Path, cfg: dict) -> None:
    data = _download(cfg["url"])
    tf = tarfile.open(fileobj=io.BytesIO(data), mode="r:xz")
    for want, suffix in cfg["members"].items():
        member = next(m for m in tf.getmembers() if m.name.endswith("/" + suffix))
        src = tf.extractfile(member)
        with open(out / want, "wb") as dst:
            shutil.copyfileobj(src, dst)
        _make_executable(out / want)
        print(f"  yazildi: {out / want}")


def main() -> int:
    os_key = _os_key()
    cfg = SOURCES[os_key]
    out = HERE / "bin" / os_key
    out.mkdir(parents=True, exist_ok=True)

    print(f"FFmpeg indiriliyor ({os_key}, {platform.machine()}) -> {out}")
    try:
        if os_key == "windows":
            fetch_windows(out, cfg)
        elif os_key == "macos":
            fetch_macos(out, cfg)
        else:
            fetch_linux(out, cfg)
    except Exception as exc:  # noqa: BLE001
        print(f"HATA: FFmpeg indirilemedi: {exc}", file=sys.stderr)
        print(
            "Manuel cozum: ffmpeg/ffprobe binary'lerini "
            f"{out} altina elle koyun.",
            file=sys.stderr,
        )
        return 1

    print("FFmpeg hazir.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
