#!/usr/bin/env bash
# KADE AutoEdit AI - Backend Server (macOS / Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

echo "============================================"
echo " KADE AutoEdit AI Backend"
echo " http://localhost:8472"
echo " Durdurmak icin: Ctrl+C"
echo "============================================"

# venv varsa kullan, yoksa sistem python'u
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python main.py
else
  echo "UYARI: .venv yok. Once ./setup.sh calistirin."
  for c in python3.12 python3.11 python3.10 python3 python; do
    if command -v "$c" >/dev/null 2>&1; then exec "$c" main.py; fi
  done
  echo "HATA: Python bulunamadi."
  exit 1
fi
