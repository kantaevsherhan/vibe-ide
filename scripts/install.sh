#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${VIBEIDE_REPO_URL:-https://github.com/kantaevsherhan/vibe-ide.git}"
BRANCH="${VIBEIDE_BRANCH:-main}"
INSTALL_DIR="${VIBEIDE_INSTALL_DIR:-$HOME/vibe-ide}"
PORT="${VIBEIDE_PORT:-8080}"
WORKSPACE_DIR="${VIBEIDE_WORKSPACE_DIR:-$INSTALL_DIR/workspace}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    echo "Install $1 and run this installer again."
    exit 1
  fi
}

need git
need node
need npm

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ is required. Current version: $(node -v)"
  exit 1
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating VibeIDE in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
else
  echo "Cloning VibeIDE into $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
mkdir -p "$WORKSPACE_DIR" logs run config

echo "Installing dependencies"
npm install

echo "Building VibeIDE"
npm run build

echo "Writing config"
VIBEIDE_PORT_VALUE="$PORT" VIBEIDE_WORKSPACE_VALUE="$WORKSPACE_DIR" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const configPath = path.join(process.cwd(), 'config', 'vibeide.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.server = config.server || {};
config.workspace = config.workspace || {};
config.server.host = config.server.host || '0.0.0.0';
config.server.port = Number(process.env.VIBEIDE_PORT_VALUE || config.server.port || 8080);
config.workspace.path = process.env.VIBEIDE_WORKSPACE_VALUE;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
NODE

PID_FILE="$INSTALL_DIR/run/vibeide.pid"
LOG_FILE="$INSTALL_DIR/logs/vibeide.log"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "Stopping old VibeIDE process $OLD_PID"
    kill "$OLD_PID" || true
    sleep 2
  fi
fi

echo "Starting VibeIDE in background"
nohup npm start >"$LOG_FILE" 2>&1 &
PID="$!"
echo "$PID" > "$PID_FILE"

echo "VibeIDE is starting."
echo "URL: http://127.0.0.1:$PORT"
echo "PID: $PID"
echo "Log: $LOG_FILE"
echo "Config: $INSTALL_DIR/config/vibeide.config.json"
echo "Workspace: $WORKSPACE_DIR"
echo
echo "Default login is admin / change-me. Change it in config/vibeide.config.json."
