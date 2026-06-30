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

install_build_tools() {
  if command -v make >/dev/null 2>&1 && command -v g++ >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
    return
  fi

  echo "Native build tools are required for node-pty."

  if [ "$(uname -s)" != "Linux" ]; then
    echo "Please install make, a C++ compiler, and Python 3, then run this installer again."
    exit 1
  fi

  local sudo_cmd=()
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
      sudo_cmd=(sudo)
    else
      echo "sudo was not found. Install these packages manually, then run this installer again:"
      echo "  Debian/Ubuntu: apt-get update && apt-get install -y build-essential python3 make g++"
      echo "  Fedora/RHEL:   dnf install -y make gcc-c++ python3"
      echo "  Alpine:        apk add --no-cache make g++ python3"
      echo "  Arch:          pacman -S --needed base-devel python"
      exit 1
    fi
  fi

  if command -v apt-get >/dev/null 2>&1; then
    echo "Installing build tools with apt-get"
    "${sudo_cmd[@]}" apt-get update
    "${sudo_cmd[@]}" apt-get install -y build-essential python3 make g++
  elif command -v dnf >/dev/null 2>&1; then
    echo "Installing build tools with dnf"
    "${sudo_cmd[@]}" dnf install -y make gcc-c++ python3
  elif command -v yum >/dev/null 2>&1; then
    echo "Installing build tools with yum"
    "${sudo_cmd[@]}" yum install -y make gcc-c++ python3
  elif command -v apk >/dev/null 2>&1; then
    echo "Installing build tools with apk"
    "${sudo_cmd[@]}" apk add --no-cache make g++ python3
  elif command -v pacman >/dev/null 2>&1; then
    echo "Installing build tools with pacman"
    "${sudo_cmd[@]}" pacman -S --needed --noconfirm base-devel python
  else
    echo "Could not detect a supported package manager."
    echo "Install make, g++, and python3 manually, then run this installer again."
    exit 1
  fi
}

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ is required. Current version: $(node -v)"
  exit 1
fi

install_build_tools

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
FRONTEND_DIST="$INSTALL_DIR/apps/frontend/dist"
BACKEND_ENTRY="$INSTALL_DIR/apps/backend/dist/main.js"

if [ ! -f "$FRONTEND_DIST/index.html" ]; then
  echo "Frontend build was not found at $FRONTEND_DIST/index.html"
  echo "The build step failed or did not produce frontend assets."
  exit 1
fi

if [ ! -f "$BACKEND_ENTRY" ]; then
  echo "Backend entry was not found at $BACKEND_ENTRY"
  echo "The build step failed or did not produce backend assets."
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "Stopping old VibeIDE process $OLD_PID"
    kill "$OLD_PID" || true
    sleep 2
  fi
fi

echo "Starting VibeIDE in background"
PORT="$PORT" \
HOST="0.0.0.0" \
WORKSPACE_DIR="$WORKSPACE_DIR" \
FRONTEND_DIST="$FRONTEND_DIST" \
NODE_ENV="${NODE_ENV:-development}" \
nohup node "$BACKEND_ENTRY" >"$LOG_FILE" 2>&1 &
PID="$!"
echo "$PID" > "$PID_FILE"

echo "Waiting for VibeIDE health check"
for attempt in $(seq 1 30); do
  if command -v curl >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$PID" >/dev/null 2>&1; then
    echo "VibeIDE failed to start. Log:"
    tail -n 80 "$LOG_FILE" || true
    exit 1
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "VibeIDE did not become healthy on http://127.0.0.1:$PORT"
    echo "Log:"
    tail -n 80 "$LOG_FILE" || true
    exit 1
  fi

  sleep 1
done

echo "VibeIDE is running."
echo "URL: http://127.0.0.1:$PORT"
echo "PID: $PID"
echo "Log: $LOG_FILE"
echo "Config: $INSTALL_DIR/config/vibeide.config.json"
echo "Workspace: $WORKSPACE_DIR"
echo
echo "Default login is admin / change-me. Change it in config/vibeide.config.json."
