#!/usr/bin/env bash
# KADE AutoEdit AI - macOS installer build (.app + .dmg)
# Mac'te calistirin. Gereksinim: Python venv (backend deps + pyinstaller),
# Node/npm, ve create-dmg (opsiyonel; yoksa hdiutil kullanilir).
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

APP_NAME="KADE AutoEdit AI"
DIST="$ROOT/dist"
APP_BUNDLE="$DIST/$APP_NAME.app"

echo "============================================"
echo " KADE AutoEdit - macOS Installer Build"
echo "============================================"

echo "[1/5] FFmpeg binary'leri indiriliyor..."
python3 packaging/fetch_ffmpeg.py

echo
echo "[2/5] Backend PyInstaller ile donduruluyor..."
pyinstaller packaging/kade-backend.spec --noconfirm --distpath "$DIST" --workpath build/pyi

echo
echo "[3/5] Panel .ccx ve dist olusturuluyor..."
bash packaging/build_ccx.sh || echo "  (uyari: .ccx uretilemedi)"

echo
echo "[4/5] .app paketi olusturuluyor..."
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"
cp packaging/macos/Info.plist "$APP_BUNDLE/Contents/Info.plist"
# PyInstaller onedir ciktisini .app icine koy
cp -R "$DIST/kade-backend/." "$APP_BUNDLE/Contents/MacOS/"
cp packaging/macos/kade-autoedit-launcher.sh "$APP_BUNDLE/Contents/MacOS/kade-autoedit-launcher"
chmod +x "$APP_BUNDLE/Contents/MacOS/kade-autoedit-launcher"
[ -d "$ROOT/panel/dist" ] && cp -R "$ROOT/panel/dist" "$APP_BUNDLE/Contents/Resources/UXPPlugin"
# Bundle ana yurutulebiliri Info.plist'teki CFBundleExecutable ile eslesir.
# Launcher once paneli Adobe UXP External klasorune kopyalar, sonra backend'i baslatir.
chmod +x "$APP_BUNDLE/Contents/MacOS/kade-backend" || true

echo
echo "[5/5] .dmg paketleniyor..."
DMG="$DIST/KADE-AutoEdit.dmg"
rm -f "$DMG"
STAGE="$(mktemp -d)"
cp -R "$APP_BUNDLE" "$STAGE/"
[ -f "$DIST/KADE-AutoEdit.ccx" ] && cp "$DIST/KADE-AutoEdit.ccx" "$STAGE/"
cat > "$STAGE/Install KADE Panel.command" <<'EOF'
#!/usr/bin/env bash
set -e
APP="/Applications/KADE AutoEdit AI.app"
SRC="$APP/Contents/Resources/UXPPlugin"
DEST="$HOME/Library/Application Support/Adobe/UXP/Plugins/External/com.kademedia.autoedit_1.0.0"
if [ ! -d "$SRC" ]; then
  echo "KADE AutoEdit AI.app once Applications klasorune suruklenmeli."
  read -r -p "Kapatmak icin Enter..."
  exit 1
fi
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"
echo "Panel kuruldu: $DEST"
echo "Premiere'i yeniden acin: Window > UXP Plugins > KADE AutoEdit"
read -r -p "Kapatmak icin Enter..."
EOF
chmod +x "$STAGE/Install KADE Panel.command"
ln -s /Applications "$STAGE/Applications" || true

if command -v create-dmg >/dev/null 2>&1; then
  create-dmg --volname "$APP_NAME" --app-drop-link 450 180 \
    "$DMG" "$STAGE" || hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
else
  hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
fi
rm -rf "$STAGE"

echo
echo "============================================"
echo " TAMAM! Installer: $DMG"
echo " .app ilk acilista paneli su klasore kurar:"
echo " ~/Library/Application Support/Adobe/UXP/Plugins/External/com.kademedia.autoedit_1.0.0"
echo
echo " NOT (imzasiz): kullanici ilk acista .app'e sag tik -> Ac demeli,"
echo " veya: xattr -dr com.apple.quarantine \"/Applications/$APP_NAME.app\""
echo "============================================"
