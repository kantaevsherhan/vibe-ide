import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyError } from 'fastify';
import { ConfigService } from './config/config.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createRequireAuth } from './modules/auth/auth.middleware.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { FilesService } from './modules/files/files.service.js';
import { registerFilesRoutes } from './modules/files/files.routes.js';
import { GitService } from './modules/git/git.service.js';
import { registerGitRoutes } from './modules/git/git.routes.js';
import { ProjectsService } from './modules/projects/projects.service.js';
import { registerProjectsRoutes } from './modules/projects/projects.routes.js';
import { TerminalService } from './modules/terminal/terminal.service.js';
import { registerTerminalRoutes } from './modules/terminal/terminal.routes.js';
import { IgnoreService } from './modules/workspace/ignore.service.js';
import { WorkspaceService } from './modules/workspace/workspace.service.js';

const app = Fastify({ logger: true });
const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, '../../..');
const configService = new ConfigService(projectRoot);
const config = await configService.load();
const workspace = new WorkspaceService(config);

await workspace.ensureReady();
await app.register(cookie, {
  secret: config.auth.sessionSecret
});
await app.register(cors, {
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.security.allowedOrigins.includes('*')) {
      if (process.env.NODE_ENV === 'production') {
        callback(null, false);
        return;
      }

      callback(null, true);
      return;
    }

    callback(null, config.security.allowedOrigins.includes(origin));
  }
});
await app.register(rateLimit, {
  global: false
});
await app.register(websocket);

const auth = new AuthService(config);
const requireAuth = createRequireAuth(auth);
const projects = new ProjectsService(workspace);
const ignore = new IgnoreService(projects, config);
const files = new FilesService(projects, ignore, config);
const git = new GitService(projects, config);
const terminals = new TerminalService(projects, config);
projects.setTerminalCountProvider((projectName) => terminals.count(projectName));

await registerAuthRoutes(app, auth);
app.get('/api/health', async () => ({ ok: true }));
app.addHook('preHandler', async (request, reply) => {
  const url = request.raw.url ?? '';
  if (
    url.startsWith('/api/projects') ||
    url.startsWith('/api/files/') ||
    url.startsWith('/api/git/') ||
    url.startsWith('/api/workspace/') ||
    url.startsWith('/api/terminal/') ||
    url.startsWith('/api/terminals')
  ) {
    await requireAuth(request, reply);
  }
});
await registerProjectsRoutes(app, projects);
await registerFilesRoutes(app, files);
await registerGitRoutes(app, git);
await registerTerminalRoutes(app, terminals, auth);

const frontendDist = process.env.FRONTEND_DIST ?? path.resolve(dirname, '../../frontend/dist');

if (existsSync(frontendDist)) {
  await app.register(fastifyStatic, {
    root: frontendDist,
    wildcard: false
  });
}

app.setNotFoundHandler((request, reply) => {
  if (request.raw.url?.startsWith('/api/') || request.raw.url?.startsWith('/ws/')) {
    reply.code(404).send({ error: 'Not found' });
    return;
  }

  if (existsSync(frontendDist)) {
    reply.sendFile('index.html');
    return;
  }

  reply.code(404).send({ error: 'Frontend build was not found. Run the Vite dev server or build frontend first.' });
});

app.setErrorHandler((error: FastifyError, _request, reply) => {
  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
  reply.code(statusCode).send({ error: error.message });
});

const port = Number(process.env.PORT ?? config.server.port);
const host = process.env.HOST ?? config.server.host;

console.log(`Starting VibeIDE backend on ${host}:${port}...`);

try {
  await app.listen({ port, host });
  console.log(`VibeIDE backend listening on http://${host}:${port}`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(`VibeIDE backend cannot start: ${host}:${port} is already in use. Stop the old process or change server.port in config/vibeide.config.json.`);
  }

  throw error;
}
