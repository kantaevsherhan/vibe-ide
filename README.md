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
