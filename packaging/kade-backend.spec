# PyInstaller spec for the KADE AutoEdit backend.
#   pyinstaller packaging/kade-backend.spec --noconfirm
# Run packaging/fetch_ffmpeg.py first so bundled ffmpeg binaries exist.
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

SPEC_DIR = Path(SPECPATH)               # packaging/
ROOT = SPEC_DIR.parent
BACKEND = ROOT / "backend"

if sys.platform == "win32":
    os_key, exe_suffix = "windows", ".exe"
elif sys.platform == "darwin":
    os_key, exe_suffix = "macos", ""
else:
    os_key, exe_suffix = "linux", ""

# --- Bundled ffmpeg/ffprobe -> placed under bin/ next to the executable ---
ffbin_dir = SPEC_DIR / "bin" / os_key
binaries = []
for tool in ("ffmpeg", "ffprobe"):
    p = ffbin_dir / f"{tool}{exe_suffix}"
    if p.exists():
        binaries.append((str(p), "bin"))
    else:
        print(f"UYARI: {p} yok — once 'python packaging/fetch_ffmpeg.py' calistirin.")

# --- Data files for libraries that ship non-code assets ---
datas = []
for pkg in ("whisper", "librosa", "scenedetect", "lazy_loader"):
    try:
        datas += collect_data_files(pkg)
    except Exception as exc:  # noqa: BLE001
        print(f"UYARI: {pkg} data toplanamadi: {exc}")

# --- Hidden imports for libraries with dynamic/conditional imports ---
hiddenimports = []
for pkg in ("whisper", "librosa", "soundfile", "scenedetect", "sklearn",
            "sklearn.utils._typedefs", "numba", "encodings"):
    try:
        hiddenimports += collect_submodules(pkg)
    except Exception:
        hiddenimports.append(pkg)

a = Analysis(
    [str(BACKEND / "server_entry.py")],
    pathex=[str(BACKEND)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "PyQt5", "PySide6", "IPython"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="kade-backend",
    console=True,                # keep a console window so the server is visible
    disable_windowed_traceback=False,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="kade-backend",
)
