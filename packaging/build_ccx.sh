#!/usr/bin/env bash
# Panel'i .ccx olarak paketle (macOS / Linux)
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/panel"
npm install
npm run build
cd "$ROOT"
python3 packaging/build_ccx.py
