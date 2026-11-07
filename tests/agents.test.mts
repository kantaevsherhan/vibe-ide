import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { after, test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { TaskQueueService } from '../apps/backend/src/modules/agents/task-queue.service.js';
import { AgentsConfigService } from '../apps/backend/src/modules/agents/agents.config.js';
import { AgentsManager } from '../apps/backend/src/modules/agents/agents.manager.js';
import { AgentsService } from '../apps/backend/src/modules/agents/agents.service.js';
import { NotificationsService } from '../apps/backend/src/modules/agents/notifications.service.js';
import { TelegramService } from '../apps/backend/src/modules/agents/telegram.service.js';
import { AutomationService, warmupDue } from '../apps/backend/src/modules/agents/automation.service.js';
import { ProjectsService } from '../apps/backend/src/modules/projects/projects.service.js';
import { WorkspaceService } from '../apps/backend/src/modules/workspace/workspace.service.js';
import { createDefaultConfig } from '../apps/backend/src/config/default-config.js';
import { ConfigService } from '../apps/backend/src/config/config.service.js';
import { SettingsService } from '../apps/backend/src/modules/settings/settings.service.js';
import { UpdateService } from '../apps/backend/src/modules/system/update.service.js';
import { RuntimeService } from '../apps/backend/src/modules/system/runtime.service.js';
import { adapterFor, launchTask } from '../apps/backend/src/modules/agents/agent-adapters.js';

// Test fixtures must never inherit a running IDE's workspace, credentials or settings paths.
const isolatedEnv = Object.keys(process.env).filter((key) =>
  (key.startsWith('VIBEIDE_') && key !== 'VIBEIDE_TEST_ROOT') || ['WORKSPACE_DIR', 'DOCKER_CONTAINER'].includes(key)
);
const originalEnv = Object.fromEntries(isolatedEnv.map((key) => [key, process.env[key]]));
for (const key of isolatedEnv) delete process.env[key];
after(() => { Object.assign(process.env, originalEnv); });

async function harness(t: TestContext) {
  const scratch = path.resolve(process.env.VIBEIDE_TEST_ROOT || '.vibeide/tests');
  await fs.mkdir(scratch, { recursive: true });
  const root = await fs.mkdtemp(path.join(scratch, 'vibe-ide-test-'));
  const appConfig = createDefaultConfig(root);
  appConfig.workspace.path = path.join(root, 'workspace');
  const workspace = new WorkspaceService(appConfig);
  await workspace.ensureReady();
  const project = path.join(workspace.root, 'demo');
  await fs.mkdir(project);
  const projects = new ProjectsService(workspace);
  const config = new AgentsConfigService(root);
  await config.load();
  await config.update({ agents: config.value.agents.map((agent) => ({
    ...agent, command: process.execPath, args: ['-e', 'console.log("agent-ok")', '{prompt}'], inputMode: 'argument' as const
  })) });
  const queue = new TaskQueueService();
  const telegram = new TelegramService(() => config.value);
  const manager = new AgentsManager(queue, new NotificationsService(telegram), config);
  const agents = new AgentsService(projects, config, queue, manager);
  const settings = new SettingsService(config, workspace, appConfig, telegram, projects);
  t.after(async () => {
    manager.shutdown();
    await until(() => manager.countRunning('demo') === 0);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return { root, project, projects, config, queue, manager, agents, settings };
}

async function until(check: () => boolean | Promise<boolean>) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error('Timed out waiting for task state.');
}

async function completed(h: Awaited<ReturnType<typeof harness>>) {
  await until(async () => {
    const tasks = await h.queue.loadTasks(h.project);
    return h.manager.countRunning('demo') === 0 && tasks.every((task) => !['running', 'queued'].includes(task.status));
  });
  return h.queue.loadTasks(h.project);
}

async function server(t: TestContext, respond: (body: any, request: http.IncomingMessage) => any) {
  const instance = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = body ? JSON.parse(body) : {};
    const output = respond(input, request);
    if (output === undefined) { response.writeHead(202).end(); return; }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(output));
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => instance.close((error) => error ? reject(error) : resolve())));
  const address = instance.address() as import('node:net').AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

test('concurrent queue mutations preserve all records and corrupt data is surfaced', async (t) => {
  const h = await harness(t);
  await Promise.all(Array.from({ length: 40 }, (_, index) => h.queue.mutateTasks(h.project, (tasks) => {
    tasks.push(h.queue.createTask('demo', 'codex', String(index)));
  })));
  assert.equal((await h.queue.loadTasks(h.project)).length, 40);
  await fs.writeFile(h.queue.tasksPath(h.project), '{broken');
  await assert.rejects(h.queue.loadTasks(h.project), SyntaxError);
});

test('concurrent submissions start one process per project and execute the whole queue', async (t) => {
  const h = await harness(t);
  const events: string[] = [];
  h.manager.attach('demo', (event) => {
    if (event.type === 'agent_task' && event.task.status === 'running') {
      assert.equal(h.manager.countRunning('demo'), 1);
      events.push(event.task.id);
    }
  });
  await Promise.all(Array.from({ length: 5 }, (_, index) => h.agents.createTask({ projectName: 'demo', agentId: 'codex', prompt: `task ${index}` })));
  const tasks = await completed(h);
  assert.equal(events.length, 5);
  assert.equal(new Set(events).size, 5);
  assert.ok(tasks.every((task) => task.status === 'done'));
  assert.match(await h.queue.readLog(h.project, tasks[0].id), /agent-ok/);
});

test('an unavailable CLI fails its task and the next agent continues', async (t) => {
  const h = await harness(t);
  await h.config.update({ agents: h.config.value.agents.map((agent) => agent.id === 'claude' ? { ...agent, command: 'vibeide-missing-test-command' } : agent) });
  await h.agents.createTask({ projectName: 'demo', agentId: 'claude', prompt: 'first' });
  await h.agents.createTask({ projectName: 'demo', agentId: 'codex', prompt: 'second' });
  const tasks = await completed(h);
  assert.deepEqual(tasks.map((task) => task.status), ['error', 'done']);
});

test('cancellation survives process exit and active retries return 409', async (t) => {
  const h = await harness(t);
  await h.config.update({ agents: h.config.value.agents.map((agent) => ({ ...agent, args: ['-e', 'console.log("started"); setTimeout(()=>{},20000)', '{prompt}'] })) });
  const { task } = await h.agents.createTask({ projectName: 'demo', agentId: 'codex', prompt: 'slow' });
  await until(async () => (await h.queue.readLog(h.project, task.id)).includes('started'));
  await assert.rejects(h.agents.retryTask(task.id), { statusCode: 409 });
  await h.agents.cancelTask(task.id);
  assert.equal((await completed(h))[0].status, 'cancelled');
});

test('interrupted work is recovered and queued work resumes', async (t) => {
  const h = await harness(t);
  await h.queue.mutateTasks(h.project, (tasks) => {
    tasks.push({ ...h.queue.createTask('demo', 'codex', 'interrupted'), status: 'running' });
    tasks.push(h.queue.createTask('demo', 'codex', 'pending'));
  });
  await h.agents.resume();
  assert.deepEqual((await completed(h)).map((task) => task.status), ['error', 'done']);
});

test('only four supported providers are listed and API credentials stay on the server', async (t) => {
  const h = await harness(t);
  const url = await server(t, (body, request) => {
    assert.equal(request.headers.authorization, 'Bearer test-model-key');
    assert.equal(body.model, 'test-model');
    return { choices: [{ message: { content: 'model-ok' } }] };
  });
  await h.settings.update({ models: {
    api: { model: 'test-model', baseUrl: `${url}/v1`, apiKey: 'test-model-key' },
    ollama: h.config.value.models.ollama
  } });
  assert.deepEqual((await h.agents.listAgents()).agents.map((agent) => agent.id).sort(), ['api', 'claude', 'codex', 'ollama']);
  assert.equal(h.settings.get().models.api.apiKey, '');
  await h.settings.update({ models: h.settings.get().models });
  assert.equal(h.config.value.models.api.apiKey, 'test-model-key');
  const { task } = await h.agents.createTask({ projectName: 'demo', agentId: 'api', prompt: 'test' });
  assert.equal((await completed(h))[0].status, 'done');
  assert.match(await h.queue.readLog(h.project, task.id), /model-ok/);
});

test('warmup matches the configured local minute and handles midnight', () => {
  const config = { projectName: 'demo', time: '04:30', timeZone: 'Asia/Qyzylorda', agents: ['codex'] as ('codex' | 'claude')[] };
  assert.equal(warmupDue(config, new Date('2026-11-06T23:30:00Z')), '2026-11-07');
  assert.equal(warmupDue(config, new Date('2026-11-06T23:31:00Z')), null);
  assert.equal(warmupDue({ ...config, time: '00:00' }, new Date('2026-11-06T19:00:00Z')), '2026-11-07');
});

test('scheduled checks are persisted once per day and selected agent', async (t) => {
  const h = await harness(t);
  await h.config.update({ warmup: { projectName: 'demo', time: '04:30', timeZone: 'Asia/Qyzylorda', agents: ['codex', 'claude'] } });
  const now = new Date('2026-11-06T23:30:30Z');
  const automation = new AutomationService(h.config, h.agents);
  await automation.tick(false, now);
  await automation.tick(false, now);
  await new AutomationService(h.config, h.agents).tick(false, now);
  await completed(h);
  assert.equal((await h.queue.loadTasks(h.project)).length, 2);
  await automation.tick(false, new Date('2026-11-07T23:30:30Z'));
  await completed(h);
  assert.equal((await h.queue.loadTasks(h.project)).length, 4);
});

test('Chronos paginates empty pages, filters scope, deduplicates and publishes review status', async (t) => {
  const h = await harness(t);
  const item = { id: 'task-1', kind: 'task', updatedAt: 1, deleted: false, data: { title: '[vibe] Fix code', project: 'demo', note: 'Implement the fix', done: false } as any };
  const other = { ...item, id: 'personal', data: { title: 'Buy milk', project: 'demo', done: false } };
  let writes = 0;
  const url = await server(t, (body, request) => {
    assert.equal(request.headers.authorization, 'Bearer chronos-test-key');
    if (!('id' in body)) return;
    let result: any;
    if (body.method === 'initialize') result = { protocolVersion: body.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'chronos-test', version: '1' } };
    else if (body.params.name === 'chronos_list') result = { content: [{ type: 'text', text: JSON.stringify(body.params.arguments.after ? { items: [item, other], nextCursor: null } : { items: [], nextCursor: 'page-two' }) }] };
    else if (body.params.name === 'chronos_upsert') {
      assert.equal(body.params.arguments.expectedUpdatedAt, item.updatedAt);
      item.data.vibeide = body.params.arguments.data.vibeide;
      item.updatedAt++;
      writes++;
      result = { content: [{ type: 'text', text: JSON.stringify(item) }] };
    }
    return { jsonrpc: '2.0', id: body.id, result };
  });
  await h.config.update({ chronos: { enabled: true, token: 'chronos-test-key', url, projectName: 'demo', agentId: 'codex' } });
  const automation = new AutomationService(h.config, h.agents);
  await automation.tick(true);
  assert.equal(automation.status.error, null);
  await completed(h);
  await automation.tick(true);
  await new AutomationService(h.config, h.agents).tick(true);
  assert.equal((await h.queue.loadTasks(h.project)).length, 1);
  assert.equal(item.data.vibeide.status, 'review');
  assert.equal(item.data.done, false);
  assert.ok(writes >= 2);
  assert.equal(h.settings.get().chronos.token, '');
});

test('schedule settings reject invalid timezones and unsupported agents', async (t) => {
  const h = await harness(t);
  await assert.rejects(h.settings.update({ warmup: { projectName: 'demo', time: '04:30', timeZone: 'wrong/zone', agents: ['codex'] } }), { statusCode: 400 });
  await assert.rejects(h.agents.createTask({ projectName: 'demo', agentId: 'gemini', prompt: 'test' }), { statusCode: 404 });
});

test('Codex accepts new project folders and removes unsupported legacy options', () => {
  const agent = { id: 'codex', name: 'Codex', command: 'codex', args: ['exec', '--ask-for-approval', 'never', '{prompt}'], enabled: true, inputMode: 'argument' as const };
  const launch = adapterFor(agent).build(agent, 'prompt with spaces', 'prompt.md');
  assert.deepEqual(launch.args, ['exec', '--skip-git-repo-check', 'prompt with spaces']);
});

test('Docker updates return host rebuild instructions before touching Git', async (t) => {
  const h = await harness(t);
  const runtime = { getRuntime: async () => ({ runtime: 'docker', source: 'detected' }) } as RuntimeService;
  await assert.rejects(new UpdateService(h.root, runtime).start(), { statusCode: 409 });
});

test('relative workspace paths are anchored to the installation directory', async (t) => {
  const h = await harness(t);
  await fs.writeFile(path.join(h.root, 'config', 'vibeide.config.json'), JSON.stringify({
    workspace: { path: 'workspace' }, auth: { password: 'test-password', sessionSecret: 'test-secret' }
  }));
  const config = await new ConfigService(h.root).load();
  assert.equal(config.workspace.path, path.join(h.root, 'workspace'));
});

test('Chronos task notifications include their source and Telegram failure does not stop execution', async (t) => {
  const h = await harness(t);
  const messages: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.match(String(url), /^https:\/\/api\.telegram\.org\/botnotification-test-token\/sendMessage$/);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.chat_id, 'notification-test-chat');
    messages.push(body.text);
    return new Response('{}', { status: messages.length === 1 ? 503 : 200 });
  });
  await h.config.update({
    notifications: { telegram: { enabled: true, botToken: 'notification-test-token', chatId: 'notification-test-chat' } }
  });
  await h.agents.createTask({
    projectName: 'demo', agentId: 'codex', prompt: 'Private implementation details should stay in the task log.'
  }, { kind: 'chronos', key: 'notification-task', title: '[vibe] Repair validation' });
  assert.equal((await completed(h))[0].status, 'done');
  assert.equal(messages.length, 2);
  assert.ok(messages.every((message) => message.includes('[vibe] Repair validation')));
  assert.ok(messages.every((message) => !message.includes('Private implementation details')));
});

test('a successful execution persists exactly one linked review with its own model and effort', async (t) => {
  const h = await harness(t);
  const url = await server(t, (body) => {
    assert.equal(body.model, 'chosen-executor');
    assert.equal(body.reasoning_effort, 'medium');
    return { choices: [{ message: { content: 'executor finished' } }] };
  });
  await h.config.update({ models: { ...h.config.value.models, api: { baseUrl: url, model: 'default-model', apiKey: '' } } });
  const { task } = await h.agents.createTask({
    projectName: 'demo', agentId: 'api', prompt: 'Review flow',
    run: { model: 'chosen-executor', effort: 'medium' },
    reviewer: { agentId: 'codex', model: 'chosen-reviewer', effort: 'high' }
  });
  const tasks = await completed(h);
  const execution = tasks.find((item) => item.id === task.id);
  const reviews = tasks.filter((item) => item.reviewOf === task.id);
  assert.equal(execution?.status, 'done');
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].id, execution?.reviewTaskId);
  assert.deepEqual(reviews[0].run, { model: 'chosen-reviewer', effort: 'high' });
  await assert.rejects(h.agents.retryTask(task.id), { statusCode: 409 });
});

test('review launch uses independent options and read-only settings', () => {
  const codex = { id: 'codex', name: 'Codex', command: 'codex', enabled: true, args: ['exec', '-m', 'old', '--sandbox', 'workspace-write', '{prompt}'], inputMode: 'argument' as const };
  const execution = launchTask(codex, 'text', 'prompt.md', { model: 'new', effort: 'medium' });
  assert.equal(execution.inputMode, 'stdin');
  assert.ok(execution.args.includes('new'));
  assert.ok(!execution.args.includes('old'));
  assert.ok(execution.args.includes('model_reasoning_effort="medium"'));
  const review = launchTask(codex, 'text', 'prompt.md', { model: 'review-model', effort: 'high' }, true);
  assert.ok(review.args.includes('read-only'));
  assert.ok(!review.args.includes('workspace-write'));
  const claude = launchTask({ ...codex, id: 'claude' }, 'text', 'prompt.md', { model: 'sonnet', effort: 'high' }, true);
  assert.ok(claude.args.includes('plan'));
  assert.ok(claude.args.includes('Read,Glob,Grep'));
  assert.ok(claude.args.includes('sonnet'));
});
