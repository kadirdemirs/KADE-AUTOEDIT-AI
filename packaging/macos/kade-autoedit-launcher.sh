#!/usr/bin/env bash
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_ID="com.kademedia.autoedit"
PLUGIN_VERSION="1.0.0"
PLUGIN_SRC="$APP_DIR/Resources/UXPPlugin"
PLUGIN_DEST="$HOME/Library/Application Support/Adobe/UXP/Plugins/External/${PLUGIN_ID}_${PLUGIN_VERSION}"

if [ -f "$PLUGIN_SRC/manifest.json" ]; then
  mkdir -p "$(dirname "$PLUGIN_DEST")"
  rm -rf "$PLUGIN_DEST"
  mkdir -p "$PLUGIN_DEST"
  cp -R "$PLUGIN_SRC/." "$PLUGIN_DEST/"
fi

exec "$APP_DIR/MacOS/kade-backend"
