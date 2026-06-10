#!/usr/bin/env bash
# KADE AutoEdit AI - Kurulum (macOS / Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo " KADE AutoEdit AI - Kurulum"
echo "============================================"
echo

# --- Python bul ---
PYTHON=""
for c in python3.12 python3.11 python3.10 python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PYTHON="$c"; break; fi
done

if [ -z "$PYTHON" ]; then
  echo "HATA: Python bulunamadi! Python 3.10+ kurun."
  echo "  macOS:  brew install python@3.12"
  echo "  Linux:  sudo apt install python3 python3-venv python3-pip"
  exit 1
fi
echo "Python: $($PYTHON --version) ($PYTHON)"

# --- FFmpeg kontrol ---
echo
echo "[1/3] FFmpeg kontrol ediliyor..."
if command -v ffmpeg >/dev/null 2>&1; then
  echo "  FFmpeg mevcut: $(ffmpeg -version | head -n1)"
else
  echo "  UYARI: FFmpeg bulunamadi!"
  echo "    macOS:  brew install ffmpeg"
  echo "    Linux:  sudo apt install ffmpeg"
fi

# --- venv + bağımlılıklar ---
echo
echo "[2/3] Sanal ortam ve bagimliliklar..."
cd "$SCRIPT_DIR/backend"
if [ ! -d ".venv" ]; then
  "$PYTHON" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# --- Panel ---
echo
echo "[3/3] Panel bagimliliklari (npm)..."
if command -v npm >/dev/null 2>&1; then
  cd "$SCRIPT_DIR/panel"
  npm install
  npm run build
else
  echo "  UYARI: npm bulunamadi. Node.js kurun: https://nodejs.org"
fi

echo
echo "============================================"
echo " Kurulum tamamlandi!"
echo " Sunucuyu baslatmak icin: ./start_server.sh"
echo "============================================"
