"""Build the Premiere UXP panel into a distributable .ccx package.

A .ccx is a zip of the plugin root: manifest.json at the top level plus the
built panel files (dist/). This panel has no native .uxpaddon binaries, so a
plain zip is valid. If the UXP Developer Tool CLI is available it is preferred;
otherwise we zip manually.

Usage:  python packaging/build_ccx.py
Run `npm run build` in panel/ first (or let build.bat/.sh do it).
"""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL = ROOT / "panel"
DIST = ROOT / "dist"
OUT = DIST / "KADE-AutoEdit.ccx"

# Minimum host version accepted by UPIA for a production .ccx install.
PROD_MIN_VERSION = "25.6.0"


def production_manifest() -> dict:
    """Return the manifest in the form UPIA/`.ccx` install requires.

    The dev manifest uses `host` as an ARRAY (what UXP Developer Tool wants).
    But a production `.ccx` installed via UPIA/double-click requires `host` to be
    a single OBJECT — otherwise UPIA rejects it with EXMAN_FAILED_INVALID_MANIFEST
    (status -267). We also bump minVersion to the install-accepted floor.
    """
    src = json.loads((PANEL / "manifest.json").read_text(encoding="utf-8"))
    host = src.get("host")
    if isinstance(host, list) and host:
        host = host[0]
    if isinstance(host, dict):
        # UPIA wants a concrete, accepted minVersion.
        host.setdefault("app", "premierepro")
        host["minVersion"] = PROD_MIN_VERSION
    src["host"] = host
    return src


def ensure_built() -> None:
    if not (PANEL / "dist" / "index.html").exists():
        print("Panel derlemesi yok — 'npm run build' calistiriliyor...")
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        subprocess.run([npm, "run", "build"], cwd=PANEL, check=True)


def zip_ccx() -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    # Files/dirs to include at the package root (manifest is written separately
    # in production form, so don't copy the dev manifest.json verbatim).
    include = [PANEL / "dist"]
    icons = PANEL / "icons"
    if icons.exists():
        include.append(icons)

    # Type-declaration / sourcemap artifacts have no place in a runtime package.
    skip_suffixes = (".d.ts", ".d.ts.map", ".map")

    # dist/ already contains a manifest.json (with main: index.html). Skip it from
    # the file walk and write the production manifest at the package root instead.
    prod_manifest = json.dumps(production_manifest(), indent=2)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", prod_manifest)
        for item in include:
            for f in item.rglob("*"):
                if not f.is_file() or f.name.endswith(skip_suffixes):
                    continue
                if f.name == "manifest.json":
                    continue  # use the production manifest written above
                zf.write(f, str(f.relative_to(PANEL / "dist")))
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
