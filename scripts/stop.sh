#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${VIBEIDE_INSTALL_DIR:-$HOME/vibe-ide}"
PID_FILE="$INSTALL_DIR/run/vibeide.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No PID file found at $PID_FILE"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [ -n "$PID" ] && kill -0 "$PID" >/dev/null 2>&1; then
  kill "$PID"
  echo "Stopped VibeIDE process $PID"
else
  echo "VibeIDE process is not running"
fi

rm -f "$PID_FILE"
