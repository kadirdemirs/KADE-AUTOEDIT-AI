"""Deploy the freshly built panel into the INSTALLED UXP plugin folder.

Why this exists: after `npm run build`, the new index.js/index.html must land in
Premiere's installed plugin folder. But you must NOT copy the dev manifest.json
there — the installed plugin needs the PRODUCTION manifest (host as a single
object, accepted minVersion). Copying the dev manifest (host as an array) makes
Premiere silently refuse to list the panel.

This script copies the built assets + writes the production manifest (reusing
build_ccx.production_manifest), so the panel keeps showing up after each rebuild.

Usage:  python packaging/deploy_dev.py
"""
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIST = ROOT / "panel" / "dist"

sys.path.insert(0, str(ROOT / "packaging"))
from build_ccx import production_manifest  # noqa: E402

PLUGIN_FOLDER = "com.kademedia.autoedit_1.0.0"


def installed_dir() -> Path:
    # Windows: %APPDATA%\Adobe\UXP\Plugins\External\<id_version>
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata) / "Adobe" / "UXP" / "Plugins" / "External" / PLUGIN_FOLDER
    # macOS
    home = Path.home()
    return home / "Library" / "Application Support" / "Adobe" / "UXP" / "Plugins" / "External" / PLUGIN_FOLDER


def main() -> int:
    if not (PANEL_DIST / "index.js").exists():
        print("panel/dist yok — once 'npm run build'.", file=sys.stderr)
        return 1
    dst = installed_dir()
    if not dst.exists():
        print(f"Kurulu plugin klasoru yok: {dst}\n"
              f"Once UPIA ile .ccx kurun (installer veya: build_ccx + UPIA /install).",
              file=sys.stderr)
        return 1

    # Copy built assets (NOT the dev manifest).
    for name in ("index.html", "index.js", "index.js.LICENSE.txt"):
        src = PANEL_DIST / name
        if src.exists():
            shutil.copy2(src, dst / name)

    # Write the production manifest (host as object).
    (dst / "manifest.json").write_text(json.dumps(production_manifest(), indent=2), encoding="utf-8")
    print(f"TAMAM: panel guncellendi -> {dst}")
    print("Premiere'de paneli kapat/ac (gerekirse Premiere'i yeniden baslat).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
