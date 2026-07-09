import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyError } from 'fastify';
import { ConfigService } from './config/config.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createRequireAuth } from './modules/auth/auth.middleware.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { AgentsConfigService } from './modules/agents/agents.config.js';
import { AgentsManager } from './modules/agents/agents.manager.js';
import { AgentsService } from './modules/agents/agents.service.js';
import { registerAgentsRoutes } from './modules/agents/agents.routes.js';
import { NotificationsService } from './modules/agents/notifications.service.js';
import { TaskQueueService } from './modules/agents/task-queue.service.js';
import { TelegramService } from './modules/agents/telegram.service.js';
import { FilesService } from './modules/files/files.service.js';
import { registerFilesRoutes } from './modules/files/files.routes.js';
import { GitService } from './modules/git/git.service.js';
import { registerGitRoutes } from './modules/git/git.routes.js';
import { HealthService } from './modules/health/health.service.js';
import { registerHealthRoutes } from './modules/health/health.routes.js';
import { NotesService } from './modules/notes/notes.service.js';
import { registerNotesRoutes } from './modules/notes/notes.routes.js';
import { ProjectsService } from './modules/projects/projects.service.js';
import { registerProjectsRoutes } from './modules/projects/projects.routes.js';
import { SettingsService } from './modules/settings/settings.service.js';
import { registerSettingsRoutes } from './modules/settings/settings.routes.js';
import { SpeechService } from './modules/speech/speech.service.js';
import { registerSpeechRoutes } from './modules/speech/speech.routes.js';
import { SystemService } from './modules/system/system.service.js';
import { registerSystemRoutes } from './modules/system/system.routes.js';
import { TerminalService } from './modules/terminal/terminal.service.js';
import { registerTerminalRoutes } from './modules/terminal/terminal.routes.js';
import { IgnoreService } from './modules/workspace/ignore.service.js';
import { WorkspaceService } from './modules/workspace/workspace.service.js';

const app = Fastify({ logger: true });
const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, '../../..');
const configService = new ConfigService(projectRoot);
const config = await configService.load();
const agentsConfigService = new AgentsConfigService(projectRoot);
await agentsConfigService.load();
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
await app.register(multipart, {
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  }
});

const auth = new AuthService(config);
const requireAuth = createRequireAuth(auth);
const projects = new ProjectsService(workspace);
const ignore = new IgnoreService(projects, config);
const files = new FilesService(projects, ignore, config);
const git = new GitService(projects, config);
const notes = new NotesService(projects);
const system = new SystemService(projectRoot);
const speech = new SpeechService(projectRoot);
const terminals = new TerminalService(projects, config);
const taskQueue = new TaskQueueService();
const telegram = new TelegramService(() => agentsConfigService.value);
const notifications = new NotificationsService(telegram);
const agentsManager = new AgentsManager(taskQueue, notifications);
const agents = new AgentsService(projects, agentsConfigService, taskQueue, agentsManager);
const health = new HealthService(git, terminals, agents);
const settings = new SettingsService(agentsConfigService, workspace, config, telegram);
projects.setTerminalCountProvider((projectName) => terminals.count(projectName));
projects.setProjectDeleteProvider((projectName) => terminals.closeProject(projectName));
projects.setGitHealthProvider((projectName) => git.health(projectName));
projects.setAgentsHealthProvider((projectName) => agents.runtimeSummary(projectName));

await registerAuthRoutes(app, auth);
app.get('/api/health', async () => ({ ok: true }));
app.addHook('preHandler', async (request, reply) => {
  const url = request.raw.url ?? '';
  if (
    url.startsWith('/api/projects') ||
    url.startsWith('/api/agents') ||
    url.startsWith('/api/files/') ||
    url.startsWith('/api/notes/') ||
    url.startsWith('/api/git/') ||
    url.startsWith('/api/settings') ||
    url.startsWith('/api/speech/') ||
    url.startsWith('/api/system/') ||
    url.startsWith('/api/workspace/') ||
    url.startsWith('/api/terminal/') ||
    url.startsWith('/api/terminals')
  ) {
    await requireAuth(request, reply);
  }
});
await registerProjectsRoutes(app, projects);
await registerFilesRoutes(app, files);
await registerNotesRoutes(app, notes);
await registerGitRoutes(app, git);
await registerSettingsRoutes(app, settings);
await registerSpeechRoutes(app, speech);
await registerSystemRoutes(app, system);
await registerTerminalRoutes(app, terminals, auth);
await registerAgentsRoutes(app, agents, agentsManager, auth);
await registerHealthRoutes(app, health);

const frontendDist = process.env.FRONTEND_DIST ?? path.resolve(dirname, '../../frontend/dist');

if (existsSync(frontendDist)) {
  await app.register(fastifyStatic, {
    root: frontendDist,
    wildcard: false,
    setHeaders: (response, filePath) => {
      if (path.basename(filePath) === 'index.html') {
        response.setHeader('Cache-Control', 'no-store');
        return;
      }

      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  });
}

app.setNotFoundHandler((request, reply) => {
  const url = request.raw.url ?? '';

  if (url.startsWith('/api/') || url.startsWith('/ws/')) {
    reply.code(404).send({ error: 'Not found' });
    return;
  }

  const pathname = new URL(url, 'http://localhost').pathname;
  const isStaticAssetRequest = pathname.startsWith('/assets/') || path.extname(pathname) !== '';
  if (isStaticAssetRequest) {
    reply.code(404).send({ error: 'Asset not found' });
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
  const logs = 'logs' in error && Array.isArray(error.logs) ? { logs: error.logs } : {};
  reply.code(statusCode).send({ error: error.message, ...logs });
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
