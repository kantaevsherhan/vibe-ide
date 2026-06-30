import type { AgentConfig, AgentListItem, AgentTask } from './agents.types.js';
import type { AgentsConfigService } from './agents.config.js';
import type { AgentsManager } from './agents.manager.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { TaskQueueService } from './task-queue.service.js';

export class AgentsService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly config: AgentsConfigService,
    private readonly queue: TaskQueueService,
    private readonly manager: AgentsManager
  ) {}

  agents() {
    return this.config.value.agents;
  }

  async listAgents(): Promise<{ agents: AgentListItem[] }> {
    const agents = await Promise.all(
      this.agents().map(async (agent) => {
        const installed = agent.enabled ? await this.manager.isInstalled(agent) : false;
        return {
          ...agent,
          installed,
          status: !agent.enabled || !installed ? 'not_installed' : 'idle'
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

  async createTask(input: { projectName: string; agentId: string; prompt: string }) {
    const projectPath = await this.projects.ensureProjectExists(input.projectName);
    const agent = this.getAgent(input.agentId);
    if (!agent.enabled) throw Object.assign(new Error('Agent is disabled.'), { statusCode: 400 });

    const task = this.queue.createTask(input.projectName, input.agentId, input.prompt);
    const tasks = await this.queue.loadTasks(projectPath);
    tasks.push(task);
    await this.queue.saveTasks(projectPath, tasks);
    await this.manager.startNext(projectPath, input.projectName, this.agents());
    return { task };
  }

  async cancelTask(taskId: string) {
    const { projectPath, task } = await this.findTask(taskId);
    if (task.status === 'running' || task.status === 'waiting') this.manager.cancel(task.projectName, taskId);
    const updated = await this.patchTask(projectPath, taskId, { status: 'cancelled', finishedAt: new Date().toISOString() });
    return { task: updated };
  }

  async retryTask(taskId: string) {
    const { projectPath, task } = await this.findTask(taskId);
    const updated = await this.patchTask(projectPath, taskId, {
      status: 'queued',
      error: undefined,
      startedAt: undefined,
      finishedAt: undefined
    });
    await this.manager.startNext(projectPath, task.projectName, this.agents());
    return { task: updated };
  }

  async moveTask(taskId: string, direction: 'up' | 'down') {
    const { projectPath, task } = await this.findTask(taskId);
    const tasks = await this.queue.peekTasks(projectPath);
    const index = tasks.findIndex((item) => item.id === taskId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index >= 0 && target >= 0 && target < tasks.length) {
      [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
      await this.queue.saveTasks(projectPath, tasks);
    }
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

  async health(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.queue.recoverInterruptedTasks(projectPath, (taskId) => this.manager.hasActiveTask(taskId));
    return this.manager.health(projectPath, projectName);
  }

  private getAgent(agentId: string): AgentConfig {
    const agent = this.agents().find((item) => item.id === agentId);
    if (!agent) throw Object.assign(new Error('Agent was not found.'), { statusCode: 404 });
    return agent;
  }

  private async patchTask(projectPath: string, taskId: string, patch: Partial<AgentTask>) {
    const tasks = await this.queue.peekTasks(projectPath);
    let updated: AgentTask | undefined;
    const next = tasks.map((task) => {
      if (task.id !== taskId) return task;
      updated = { ...task, ...patch, updatedAt: new Date().toISOString() };
      return updated;
    });
    await this.queue.saveTasks(projectPath, next);
    return updated;
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
