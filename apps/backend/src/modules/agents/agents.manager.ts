import os from 'node:os';
import pty, { type IPty } from 'node-pty';
import { execa } from 'execa';
import type { AgentConfig, AgentSession, AgentTask, AgentWsMessage } from './agents.types.js';
import { adapterFor } from './agent-adapters.js';
import type { NotificationsService } from './notifications.service.js';
import type { TaskQueueService } from './task-queue.service.js';

type SendMessage = (message: AgentWsMessage) => void;
type ActiveProcess = {
  taskId: string;
  projectName: string;
  agentId: string;
  pty: IPty;
  timeout?: NodeJS.Timeout;
};

export class AgentsManager {
  private readonly clients = new Map<SendMessage, string>();
  private readonly active = new Map<string, ActiveProcess>();
  private readonly installedCache = new Map<string, boolean>();
  private readonly commandPathCache = new Map<string, string>();
  private readonly commandErrorCache = new Map<string, string>();

  constructor(
    private readonly queue: TaskQueueService,
    private readonly notifications: NotificationsService
  ) {}

  attach(projectName: string, send: SendMessage) {
    this.clients.set(send, projectName);
  }

  detach(send: SendMessage) {
    this.clients.delete(send);
  }

  async isInstalled(agent: AgentConfig) {
    const cacheKey = `${agent.command}:${agent.args.join(' ')}`;
    if (this.installedCache.has(cacheKey)) return this.installedCache.get(cacheKey) ?? false;

    const checker = os.platform() === 'win32' ? 'where' : 'which';
    const result = await execa(checker, [agent.command], { reject: false });
    const installed = result.exitCode === 0;
    if (installed) {
      const commandPath = this.pickExecutablePath(result.stdout);
      if (commandPath) this.commandPathCache.set(cacheKey, commandPath);
    }
    if (!installed) {
      this.commandErrorCache.set(cacheKey, result.stderr || `${agent.command} was not found in PATH.`);
    }
    this.installedCache.set(cacheKey, installed);
    return installed;
  }

  resolvedCommand(agent: AgentConfig) {
    return this.commandPathCache.get(this.cacheKey(agent));
  }

  lastCommandError(agent: AgentConfig) {
    return this.commandErrorCache.get(this.cacheKey(agent));
  }

  async startNext(projectPath: string, projectName: string, agents: AgentConfig[]) {
    if ([...this.active.values()].some((item) => item.projectName === projectName)) return;

    const tasks = await this.queue.loadTasks(projectPath);
    const task = tasks.find((item) => item.status === 'queued');
    if (!task) return;

    const agent = agents.find((item) => item.id === task.agentId && item.enabled);
    if (!agent) {
      await this.updateTask(projectPath, task.id, { status: 'error', error: 'Agent is disabled or missing.' });
      return;
    }

    if (!(await this.isInstalled(agent))) {
      await this.updateTask(projectPath, task.id, { status: 'error', error: 'Agent is not installed.' });
      return;
    }

    await this.runTask(projectPath, projectName, agents, agent, task);
  }

  cancel(projectName: string, taskId: string) {
    const active = this.active.get(taskId);
    if (active?.projectName === projectName) {
      if (active.timeout) clearTimeout(active.timeout);
      active.pty.kill();
      this.active.delete(taskId);
    }
  }

  hasActiveTask(taskId: string) {
    return this.active.has(taskId);
  }

  countRunning(projectName: string) {
    return [...this.active.values()].filter((item) => item.projectName === projectName).length;
  }

  async health(projectPath: string, projectName: string) {
    const tasks = await this.queue.peekTasks(projectPath);
    return {
      running: this.countRunning(projectName),
      waiting: tasks.filter((task) => task.projectName === projectName && task.status === 'waiting').length,
      errors: tasks.filter((task) => task.projectName === projectName && task.status === 'error').length
    };
  }

  private async runTask(projectPath: string, projectName: string, agents: AgentConfig[], agent: AgentConfig, task: AgentTask) {
    const now = new Date().toISOString();
    const session: AgentSession = {
      id: `${task.id}:${agent.id}`,
      agentId: agent.id,
      projectName,
      status: 'running',
      currentTaskId: task.id,
      startedAt: now,
      updatedAt: now,
      lastOutput: ''
    };

    await this.updateTask(projectPath, task.id, { status: 'running', startedAt: now, error: undefined });
    await this.upsertSession(projectPath, session);

    const shellEnv = this.buildAgentEnv(agent, projectName, projectPath);
    const context = await this.queue.readContext(projectPath);
    const finalPrompt = this.queue.buildPrompt(context, task, projectPath);
    const promptFile = await this.queue.writePromptFile(projectPath, task.id, finalPrompt);
    const launch = adapterFor(agent).build(agent, finalPrompt, promptFile);
    let ptyProcess: IPty;
    try {
      ptyProcess = pty.spawn(this.resolveCommand({ ...agent, command: launch.command }), launch.args, {
        name: 'xterm-color',
        cols: 100,
        rows: 28,
        cwd: projectPath,
        env: shellEnv
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start agent process.';
      await this.queue.appendLog(projectPath, task.id, `${message}\n`);
      await this.finishStartupError(projectPath, projectName, agent, task.id, message);
      return;
    }

    const timeout = agent.timeoutMs
      ? setTimeout(() => {
          if (!this.active.has(task.id)) return;
          void this.queue.appendLog(projectPath, task.id, `\nAgent timed out after ${agent.timeoutMs}ms.\n`);
          ptyProcess.kill();
        }, agent.timeoutMs)
      : undefined;

    this.active.set(task.id, { taskId: task.id, projectName, agentId: agent.id, pty: ptyProcess, timeout });
    this.broadcast(projectName, { type: 'agent_status', session });

    if ((launch.inputMode ?? 'stdin') === 'stdin') {
      ptyProcess.write(`${finalPrompt}\n`);
    }

    ptyProcess.onData((data) => {
      const cleanData = this.queue.cleanOutput(data);
      void this.queue.appendLog(projectPath, task.id, data);
      void this.updateSession(projectPath, session.id, {
        lastOutput: cleanData.slice(-2000),
        updatedAt: new Date().toISOString()
      });
      this.broadcast(projectName, { type: 'agent_output', taskId: task.id, agentId: agent.id, data: cleanData });
    });

    ptyProcess.onExit((event) => {
      if (!this.active.has(task.id)) return;
      void this.finishTask(projectPath, projectName, agents, agent, task.id, event.exitCode === 0 ? 'done' : 'error', event.exitCode);
    });
  }

  private async finishTask(
    projectPath: string,
    projectName: string,
    agents: AgentConfig[],
    agent: AgentConfig,
    taskId: string,
    status: 'done' | 'error',
    exitCode: number
  ) {
    const active = this.active.get(taskId);
    if (active?.timeout) clearTimeout(active.timeout);
    this.active.delete(taskId);
    const error = status === 'error' ? `Agent exited with code ${exitCode}.` : undefined;
    const task = await this.updateTask(projectPath, taskId, { status, error, finishedAt: new Date().toISOString() });
    await this.updateSession(projectPath, `${taskId}:${agent.id}`, {
      status: status === 'done' ? 'finished' : 'error',
      updatedAt: new Date().toISOString(),
      lastOutput: error
    });

    if (task) {
      if (status === 'done') await this.notifications.taskDone(agent.name, task);
      if (status === 'error') await this.notifications.taskError(agent.name, task);
    }

    await this.startNext(projectPath, projectName, agents);
  }

  private async finishStartupError(projectPath: string, projectName: string, agent: AgentConfig, taskId: string, message: string) {
    const task = await this.updateTask(projectPath, taskId, {
      status: 'error',
      error: message,
      finishedAt: new Date().toISOString()
    });
    await this.updateSession(projectPath, `${taskId}:${agent.id}`, {
      status: 'error',
      updatedAt: new Date().toISOString(),
      lastOutput: message
    });
    if (task) await this.notifications.taskError(agent.name, task);
    this.broadcast(projectName, { type: 'agent_error', taskId, agentId: agent.id, message });
  }

  private async updateTask(projectPath: string, taskId: string, patch: Partial<AgentTask>) {
    const tasks = await this.queue.peekTasks(projectPath);
    let updated: AgentTask | undefined;
    const next = tasks.map((task) => {
      if (task.id !== taskId) return task;
      updated = {
        ...task,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      return updated;
    });
    await this.queue.saveTasks(projectPath, next);
    if (updated) this.broadcast(updated.projectName, { type: 'agent_task', task: updated });
    return updated;
  }

  private async upsertSession(projectPath: string, session: AgentSession) {
    const sessions = await this.queue.loadSessions(projectPath);
    const next = sessions.filter((item) => item.id !== session.id);
    next.push(session);
    await this.queue.saveSessions(projectPath, next);
  }

  private async updateSession(projectPath: string, sessionId: string, patch: Partial<AgentSession>) {
    const sessions = await this.queue.loadSessions(projectPath);
    let updated: AgentSession | undefined;
    const next = sessions.map((session) => {
      if (session.id !== sessionId) return session;
      updated = { ...session, ...patch };
      return updated;
    });
    await this.queue.saveSessions(projectPath, next);
    if (updated) this.broadcast(updated.projectName, { type: 'agent_status', session: updated });
  }

  private broadcast(projectName: string, message: AgentWsMessage) {
    for (const [send, clientProjectName] of this.clients) {
      if (clientProjectName === projectName) send(message);
    }
  }

  private resolveCommand(agent: AgentConfig) {
    const cached = this.commandPathCache.get(this.cacheKey(agent));
    if (cached) return cached;
    if (os.platform() !== 'win32' || /\.[a-z0-9]+$/i.test(agent.command)) return agent.command;

    const fallback = this.commandPathCache.get(`${agent.command}.cmd:${agent.args.join(' ')}`);
    return fallback ?? agent.command;
  }

  private buildAgentEnv(agent: AgentConfig, projectName: string, projectPath: string) {
    const env = {
      ...process.env,
      VIBEIDE_PROJECT: projectName,
      VIBEIDE_PROJECT_ROOT: projectPath
    };

    const permissionConfig = JSON.stringify({
      permission: {
        external_directory: {
          '*': 'deny'
        },
        bash: {
          '*': 'allow',
          'cd /*': 'deny',
          'cd ~*': 'deny',
          'rm -rf /*': 'deny',
          'rm -rf ~*': 'deny'
        }
      }
    });

    if (agent.id === 'opencode') {
      return {
        ...env,
        OPENCODE_CONFIG_CONTENT: permissionConfig
      };
    }

    if (agent.id === 'mimo') {
      return {
        ...env,
        MIMOCODE_CONFIG_CONTENT: permissionConfig,
        MIMOCODE_PERMISSION: JSON.stringify({
          external_directory: {
            '*': 'deny'
          }
        })
      };
    }

    return env;
  }

  private pickExecutablePath(stdout: string) {
    const paths = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (os.platform() !== 'win32') return paths[0];

    return (
      paths.find((item) => /\.(cmd|exe|bat|ps1)$/i.test(item)) ??
      paths[0]
    );
  }

  private cacheKey(agent: AgentConfig) {
    return `${agent.command}:${agent.args.join(' ')}`;
  }
}
