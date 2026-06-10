"""Build the Premiere UXP panel into a distributable .ccx package.

A .ccx is a zip of the plugin root: manifest.json at the top level plus the
built panel files (dist/). This panel has no native .uxpaddon binaries, so a
plain zip is valid. If the UXP Developer Tool CLI is available it is preferred;
otherwise we zip manually.

Usage:  python packaging/build_ccx.py
Run `npm run build` in panel/ first (or let build.bat/.sh do it).
"""
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL = ROOT / "panel"
DIST = ROOT / "dist"
OUT = DIST / "KADE-AutoEdit.ccx"


def ensure_built() -> None:
    if not (PANEL / "dist" / "index.html").exists():
        print("Panel derlemesi yok — 'npm run build' calistiriliyor...")
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        subprocess.run([npm, "run", "build"], cwd=PANEL, check=True)


def zip_ccx() -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    # Files/dirs to include at the package root.
    include = [PANEL / "manifest.json", PANEL / "dist"]
    icons = PANEL / "icons"
    if icons.exists():
        include.append(icons)

    # Type-declaration / sourcemap artifacts have no place in a runtime package.
    skip_suffixes = (".d.ts", ".d.ts.map", ".map")

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in include:
            if item.is_file():
                zf.write(item, item.name)
            else:
                for f in item.rglob("*"):
                    if f.is_file() and not f.name.endswith(skip_suffixes):
                        zf.write(f, str(f.relative_to(PANEL)))
    return OUT


def main() -> int:
    try:
        ensure_built()
    except subprocess.CalledProcessError as exc:
        print(f"HATA: panel derlenemedi: {exc}", file=sys.stderr)
        return 1

    out = zip_ccx()
    size_kb = out.stat().st_size // 1024
    print(f"TAMAM: {out} ({size_kb} KB)")
    print("Kurulum: .ccx dosyasina cift tiklayin (Creative Cloud yukler),")
    print("veya UXP Developer Tool ile 'Load' edin.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
