import type { AgentConfig, AgentListItem, AgentTask, CreateAgentTaskInput } from './agents.types.js';
import { validateTaskOptions } from './task-options.js';
import type { AgentsConfigService } from './agents.config.js';
import type { AgentsManager } from './agents.manager.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { TaskQueueService } from './task-queue.service.js';
import { apiAgents } from './api-agent.js';

export class AgentsService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly config: AgentsConfigService,
    private readonly queue: TaskQueueService,
    private readonly manager: AgentsManager
  ) {}

  agents() {
    return [...this.config.value.agents, ...apiAgents(this.config.value.models)];
  }

  async listAgents(): Promise<{ agents: AgentListItem[] }> {
    const agents = await Promise.all(
      this.agents().map(async (agent) => {
        const installed = agent.enabled ? await this.manager.isInstalled(agent) : false;
        return {
          ...agent,
          installed,
          status: !agent.enabled || !installed ? 'not_installed' : 'idle',
          resolvedCommand: this.manager.resolvedCommand(agent),
          lastError: this.manager.lastCommandError(agent)
        } satisfies AgentListItem;
      })
    );
    return { agents };
  }

  async status(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    return {
      agents: (await this.listAgents()).agents,
      sessions: await this.queue.loadSessions(projectPath),
      tasks: await this.queue.recoverInterruptedTasks(projectPath, (taskId) => this.manager.hasActiveTask(taskId))
    };
  }

  async tasks(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    return { tasks: await this.queue.recoverInterruptedTasks(projectPath, (taskId) => this.manager.hasActiveTask(taskId)) };
  }

  async createTask(input: CreateAgentTaskInput, source?: AgentTask['source']) {
    if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 100_000) {
      throw Object.assign(new Error('Prompt must contain 1–100000 characters.'), { statusCode: 400 });
    }
    const projectPath = await this.projects.ensureProjectExists(input.projectName);
    const agent = this.getAgent(input.agentId);
    if (!agent.enabled) throw Object.assign(new Error('Agent is disabled.'), { statusCode: 400 });
    const options = validateTaskOptions(input);
    if (options.reviewer) {
      const reviewer = this.getAgent(options.reviewer.agentId);
      if (!reviewer.enabled || !(await this.manager.isInstalled(reviewer))) {
        throw Object.assign(new Error('The review agent is disabled or missing from the backend.'), { statusCode: 400 });
      }
    }

    const task = await this.queue.mutateTasks(projectPath, (tasks) => {
      const existing = source && tasks.find((item) => item.source?.kind === source.kind && item.source.key === source.key);
      if (existing) return existing;
      const next = this.queue.createTask(input.projectName, input.agentId, input.prompt.trim());
      Object.assign(next, options, { source });
      tasks.push(next);
      return next;
    });
    await this.manager.startNext(projectPath, input.projectName, this.agents());
    return { task };
  }

  async cancelTask(taskId: string) {
    const { projectPath, task } = await this.findTask(taskId);
    const updated = await this.patchTask(projectPath, taskId, { status: 'cancelled', finishedAt: new Date().toISOString() }, (current) => {
      if (!['queued', 'running', 'waiting'].includes(current.status)) {
        throw Object.assign(new Error('Only queued or running tasks can be cancelled.'), { statusCode: 409 });
      }
    });
    this.manager.cancel(task.projectName, taskId);
    if (!this.manager.hasActiveTask(taskId)) await this.manager.startNext(projectPath, task.projectName, this.agents());
    return { task: updated };
  }

  async retryTask(taskId: string) {
    const { projectPath, task } = await this.findTask(taskId);
    if (task.reviewTaskId) {
      throw Object.assign(new Error('Open the linked review to retry it, or submit a new execution.'), { statusCode: 409 });
    }
    if (this.manager.hasActiveTask(taskId)) {
      throw Object.assign(new Error('Wait for the current process to stop before retrying.'), { statusCode: 409 });
    }
    const updated = await this.patchTask(projectPath, taskId, {
      status: 'queued',
      error: undefined,
      startedAt: undefined,
      finishedAt: undefined
    }, (current) => {
      if (current.reviewTaskId || ['running', 'waiting', 'queued'].includes(current.status)) {
        throw Object.assign(new Error('This task cannot be retried in its current state.'), { statusCode: 409 });
      }
    });
    await this.manager.startNext(projectPath, task.projectName, this.agents());
    return { task: updated };
  }

  async moveTask(taskId: string, direction: 'up' | 'down') {
    const { projectPath, task } = await this.findTask(taskId);
    await this.queue.mutateTasks(projectPath, (tasks) => {
      const index = tasks.findIndex((item) => item.id === taskId);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index >= 0 && target >= 0 && target < tasks.length) {
        [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
      }
    });
    return { task };
  }

  async taskLog(taskId: string) {
    const { projectPath } = await this.findTask(taskId);
    return { log: await this.queue.readLog(projectPath, taskId) };
  }

  async snapshot(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    return {
      sessions: await this.queue.loadSessions(projectPath),
      tasks: await this.queue.recoverInterruptedTasks(projectPath, (taskId) => this.manager.hasActiveTask(taskId))
    };
  }

  countRunning(projectName: string) {
    return this.manager.countRunning(projectName);
  }

  async resume() {
    for (const project of await this.projects.list()) {
      const projectPath = await this.projects.ensureProjectExists(project.folderName);
      await this.queue.recoverInterruptedTasks(projectPath, (id) => this.manager.hasActiveTask(id));
      await this.manager.startNext(projectPath, project.folderName, this.agents());
    }
  }

  async health(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.queue.recoverInterruptedTasks(projectPath, (taskId) => this.manager.hasActiveTask(taskId));
    return this.manager.health(projectPath, projectName);
  }

  async runtimeSummary(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const [health, tasks] = await Promise.all([
      this.health(projectName),
      this.queue.recoverInterruptedTasks(projectPath, (taskId) => this.manager.hasActiveTask(taskId))
    ]);
    return {
      ...health,
      activeTasks: tasks.filter((task) => task.status === 'queued' || task.status === 'running' || task.status === 'waiting').length
    };
  }

  private getAgent(agentId: string): AgentConfig {
    const agent = this.agents().find((item) => item.id === agentId);
    if (!agent) throw Object.assign(new Error('Agent was not found.'), { statusCode: 404 });
    return agent;
  }

  private async patchTask(projectPath: string, taskId: string, patch: Partial<AgentTask>, validate: (task: AgentTask) => void) {
    return this.queue.mutateTasks(projectPath, (tasks) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      validate(task);
      Object.assign(task, patch, { updatedAt: new Date().toISOString() });
      return task;
    });
  }

  private async findTask(taskId: string) {
    const projects = await this.projects.list();
    for (const project of projects) {
      const projectPath = await this.projects.ensureProjectExists(project.folderName);
      const tasks = await this.queue.loadTasks(projectPath);
      const task = tasks.find((item) => item.id === taskId);
      if (task) return { projectPath, task };
    }
    throw Object.assign(new Error('Task was not found.'), { statusCode: 404 });
  }
}
