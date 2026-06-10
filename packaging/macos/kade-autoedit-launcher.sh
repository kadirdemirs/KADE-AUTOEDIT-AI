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

# Register a LaunchAgent so the backend autostarts on every login (no manual server).
BACKEND_BIN="$APP_DIR/MacOS/kade-backend"
AGENT_SRC="$APP_DIR/Resources/com.kademedia.autoedit.plist"
AGENT_DEST="$HOME/Library/LaunchAgents/com.kademedia.autoedit.plist"
if [ -f "$AGENT_SRC" ]; then
  mkdir -p "$HOME/Library/LaunchAgents"
  sed "s|__BACKEND_PATH__|$BACKEND_BIN|g" "$AGENT_SRC" > "$AGENT_DEST"
  launchctl unload "$AGENT_DEST" 2>/dev/null || true
  launchctl load "$AGENT_DEST" 2>/dev/null || true
fi

exec "$BACKEND_BIN"
