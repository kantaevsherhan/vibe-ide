#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${VIBEIDE_REPO_URL:-https://github.com/kantaevsherhan/vibe-ide.git}"
BRANCH="${VIBEIDE_BRANCH:-main}"
INSTALL_DIR="${VIBEIDE_INSTALL_DIR:-$HOME/vibe-ide}"
PORT="${VIBEIDE_PORT:-8080}"
WORKSPACE_DIR="${VIBEIDE_WORKSPACE_DIR:-$INSTALL_DIR/workspace}"
AUTOSTART="${VIBEIDE_AUTOSTART:-1}"

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

sudo_prefix() {
  if [ "$(id -u)" -eq 0 ]; then
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    printf 'sudo'
    return 0
  fi

  return 1
}

ensure_user_writable_dir() {
  local dir="$1"
  local label="$2"
  local parent
  local owner_name
  parent="$(dirname "$dir")"
  owner_name="$(id -un 2>/dev/null || printf 'current user')"

  if [ -d "$dir" ]; then
    if [ -w "$dir" ]; then
      return
    fi
  elif [ -d "$parent" ] && [ -w "$parent" ]; then
    mkdir -p "$dir"
    return
  fi

  if [ "$(id -u)" -eq 0 ]; then
    mkdir -p "$dir"
    return
  fi

  local sudo_cmd
  if sudo_cmd="$(sudo_prefix)"; then
    echo "$label requires elevated permissions: $dir"
    echo "Creating it with sudo and assigning it to $owner_name"
    "$sudo_cmd" mkdir -p "$dir"
    "$sudo_cmd" chown -R "$(id -u):$(id -g)" "$dir"
    return
  fi

  echo "$label is not writable: $dir"
  echo "Choose a user-writable path, for example:"
  echo "  VIBEIDE_INSTALL_DIR=\$HOME/vibe-ide"
  echo "Or create it manually as root and give ownership to this user:"
  echo "  mkdir -p '$dir' && chown -R $(id -u):$(id -g) '$dir'"
  exit 1
}

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
ensure_user_writable_dir "$INSTALL_DIR" "Install directory"
ensure_user_writable_dir "$WORKSPACE_DIR" "Workspace directory"

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
NODE_BIN="$(command -v node)"
START_SCRIPT="$INSTALL_DIR/run/start-vibeide.sh"

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

cat > "$START_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$INSTALL_DIR"
export PORT="$PORT"
export HOST="0.0.0.0"
export WORKSPACE_DIR="$WORKSPACE_DIR"
export FRONTEND_DIST="$FRONTEND_DIST"
export NODE_ENV="\${NODE_ENV:-development}"
exec "$NODE_BIN" "$BACKEND_ENTRY"
EOF
chmod +x "$START_SCRIPT"

install_autostart() {
  if [ "$AUTOSTART" = "0" ] || [ "$AUTOSTART" = "false" ]; then
    echo "Autostart disabled by VIBEIDE_AUTOSTART=$AUTOSTART"
    return
  fi

  local os_name
  os_name="$(uname -s)"

  if [ "$os_name" = "Linux" ]; then
    if command -v systemctl >/dev/null 2>&1; then
      local systemd_dir="$HOME/.config/systemd/user"
      local service_file="$systemd_dir/vibeide.service"
      mkdir -p "$systemd_dir"
      cat > "$service_file" <<EOF
[Unit]
Description=VibeIDE
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$START_SCRIPT
Restart=always
RestartSec=5
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE

[Install]
WantedBy=default.target
EOF
      systemctl --user daemon-reload >/dev/null 2>&1 || true
      if systemctl --user enable vibeide.service >/dev/null 2>&1; then
        echo "Autostart enabled with systemd user service: $service_file"
        if command -v loginctl >/dev/null 2>&1; then
          loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || true
        fi
        return
      fi
    fi

    if command -v crontab >/dev/null 2>&1; then
      local cron_line="@reboot $START_SCRIPT >> '$LOG_FILE' 2>&1"
      (crontab -l 2>/dev/null | grep -vF "$START_SCRIPT"; printf '%s\n' "$cron_line") | crontab -
      echo "Autostart enabled with crontab @reboot"
      return
    fi

    echo "Autostart was not enabled: systemd user service and crontab are unavailable."
    return
  fi

  if [ "$os_name" = "Darwin" ]; then
    local launch_dir="$HOME/Library/LaunchAgents"
    local plist_file="$launch_dir/kz.kansherhan.vibeide.plist"
    mkdir -p "$launch_dir"
    cat > "$plist_file" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>kz.kansherhan.vibeide</string>
  <key>ProgramArguments</key>
  <array>
    <string>$START_SCRIPT</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$INSTALL_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>
</dict>
</plist>
EOF
    launchctl unload "$plist_file" >/dev/null 2>&1 || true
    launchctl load -w "$plist_file" >/dev/null 2>&1 || true
    echo "Autostart enabled with macOS LaunchAgent: $plist_file"
    return
  fi

  echo "Autostart is not supported for OS: $os_name"
}

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "Stopping old VibeIDE process $OLD_PID"
    kill "$OLD_PID" || true
    sleep 2
  fi
fi

echo "Starting VibeIDE in background"
nohup "$START_SCRIPT" >"$LOG_FILE" 2>&1 &
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
install_autostart
echo "URL: http://127.0.0.1:$PORT"
echo "PID: $PID"
echo "Log: $LOG_FILE"
echo "Config: $INSTALL_DIR/config/vibeide.config.json"
echo "Workspace: $WORKSPACE_DIR"
echo
echo "Default login is admin / change-me. Change it in config/vibeide.config.json."
