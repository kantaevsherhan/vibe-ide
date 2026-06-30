# VibeIDE

VibeIDE is a small browser IDE for vibe-coding in a local `workspace` folder. It uses Vue 3, Monaco Editor, xterm.js, Fastify, WebSocket terminals, and plain filesystem APIs.

## Run locally

```bash
npm install
npm run dev
```

Frontend only:

```bash
cd apps/frontend
npm run dev
```

Backend only:

```bash
cd apps/backend
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API/WebSocket calls to the backend on `http://127.0.0.1:8080`.

## Build and start

```bash
npm run build
npm start
```

Open `http://localhost:8080`.

## Docker

```bash
docker build -t vibe-ide .
docker run -p 8080:8080 -v ./workspace:/workspace vibe-ide
```

For an absolute host workspace:

```bash
docker run -p 8080:8080 -v /home/projects:/workspace vibe-ide
```

## One-command Install

Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/kantaevsherhan/vibe-ide/main/scripts/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/kantaevsherhan/vibe-ide/main/scripts/install.ps1 | iex
```

The installer:

- clones or updates `https://github.com/kantaevsherhan/vibe-ide.git`;
- installs npm dependencies;
- builds frontend and backend;
- writes `config/vibeide.config.json`;
- starts the production backend in the background;
- serves the built frontend from the backend;
- checks that `http://127.0.0.1:8080/api/health` and `http://127.0.0.1:8080/` respond;
- stores logs and PID under the install directory.

Defaults:

```txt
Install dir: ~/vibe-ide on Linux/macOS, %USERPROFILE%\vibe-ide on Windows
URL: http://127.0.0.1:8080
Workspace: <install-dir>/workspace
Login: admin / change-me
```

After installer startup, open the URL printed by the installer, usually:

```txt
http://127.0.0.1:8080
```

Do not open `apps/frontend/dist/index.html` directly as a file. The built frontend must be served by the backend so API, auth cookies and WebSocket terminal work.

Custom Linux/macOS install:

```bash
curl -fsSL https://raw.githubusercontent.com/kantaevsherhan/vibe-ide/main/scripts/install.sh \
  | env VIBEIDE_INSTALL_DIR=/opt/vibe-ide VIBEIDE_PORT=9090 VIBEIDE_WORKSPACE_DIR=/home/projects bash
```

Custom Windows install:

```powershell
irm https://raw.githubusercontent.com/kantaevsherhan/vibe-ide/main/scripts/install.ps1 | iex
# or after downloading:
.\scripts\install.ps1 -InstallDir C:\vibe-ide -Port 9090 -WorkspaceDir C:\projects
```

Stop background process:

```bash
~/vibe-ide/scripts/stop.sh
```

```powershell
& "$env:USERPROFILE\vibe-ide\scripts\stop.ps1"
```

## Security

VibeIDE is protected by a single username/password from:

```txt
config/vibeide.config.json
```

Change these values before exposing the app:

```json
{
  "auth": {
    "username": "admin",
    "password": "change-me",
    "sessionSecret": "change-this-secret"
  }
}
```

Do not keep `change-me` in production. Anyone with that password can read and edit workspace files and open a terminal inside the workspace. Also replace `sessionSecret` with a long random value so session cookies cannot be guessed.

Change the port and host in the same file:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080
  }
}
```

Change the workspace folder here:

```json
{
  "workspace": {
    "path": "/workspace"
  }
}
```

Docker also sets `WORKSPACE_DIR=/workspace`, which overrides the config workspace path.

Feature flags and file limits live under `security`:

```json
{
  "security": {
    "allowTerminal": true,
    "allowGit": true,
    "maxFileSizeMb": 10,
    "allowedOrigins": ["https://ide.example.com"]
  }
}
```

For production behind Nginx, terminate HTTPS at Nginx and proxy to VibeIDE on localhost. Use a concrete domain in `allowedOrigins`; `["*"]` is intended only for development.

Minimal Nginx shape:

```nginx
server {
  listen 443 ssl;
  server_name ide.example.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## API

Files:

```txt
GET    /api/files/tree
GET    /api/files/read?path=
POST   /api/files/write
POST   /api/files/create-file
POST   /api/files/create-folder
DELETE /api/files/delete?path=
```

Git:

```txt
GET /api/git/status
GET /api/git/diff?path=
```

Terminal WebSocket:

```txt
/ws/terminal
```

All file operations are constrained to `workspace` through `safePath`.
All `/api/files/*`, `/api/git/*`, `/api/workspace/*`, and `/ws/terminal` endpoints require a valid session cookie.

## Projects

VibeIDE treats every folder inside `workspace` as a separate project:

```txt
workspace/
├── my-react-app/
├── backend-api/
└── landing-page/
```

After login, VibeIDE opens `/projects`. From there you can create a project with a display name, folder name, and description. Creating a project makes:

```txt
workspace/<folder-name>/.vibeide/project.json
```

Open a project from the card grid to enter:

```txt
/ide/<folder-name>
```

Inside the IDE, file operations, Git commands, and terminal processes are scoped to that project folder only. Use `← Projects` to leave the IDE and return to the project list.

Project terminals are kept in backend memory while the backend process is running. If you leave a project and open it again, active terminals and their buffered output are restored. After backend restart, active terminals are reset; project files and metadata remain on disk.

## Lazy Workspace Loading

VibeIDE does not scan the whole project at once. The file explorer loads only the project root first, then asks the backend for one folder level at a time:

```txt
GET /api/files/children?projectName=my-project&path=src
```

Closed folders are not read, and files are read only when opened. This keeps large JS, Python, Java, Flutter, and mixed projects responsive.

Folder responses are limited by:

```json
{
  "workspace": {
    "maxFolderChildren": 500
  }
}
```

If a folder has more items than the limit, VibeIDE shows `Folder is too large` and does not render thousands of nodes.

## Auto Ignore

VibeIDE marks heavy or generated folders as ignored by default, including:

```txt
node_modules, dist, build, target, .next, .nuxt, .venv, vendor, .git
```

Projects can add custom rules in:

```txt
workspace/<project>/.vibeignore
```

Example:

```txt
node_modules
dist
logs
*.log
*.zip
```

Ignored folders are still visible, but VibeIDE does not auto-open or deep-scan them.

## Ignored Folders

Ignored folders appear muted with an `ignored` badge. Clicking one shows:

```txt
This folder is ignored for performance.
```

Use `Open Anyway` to load only the first level:

```txt
GET /api/files/children?projectName=my-project&path=node_modules&force=true
```

Large and binary files are protected. Files above `security.maxFileSizeMb` are rejected by the backend, and binary formats such as images, archives, videos, executables, and PDFs are not opened in Monaco as text.

## Project Runtime Dashboard

The IDE header shows a compact runtime dashboard:

```txt
🖥 terminals   🤖 agents   📋 tasks
```

Terminals use the real active terminal count for the current project. AI agents and tasks are placeholders for now and show `0` with `AI coming soon`.
