import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentSession, AgentTask } from './agents.types.js';

export class TaskQueueService {
  async ensureProjectState(projectPath: string) {
    await fs.mkdir(this.logsDir(projectPath), { recursive: true });
    await this.ensureJsonFile(this.tasksPath(projectPath), []);
    await this.ensureJsonFile(this.sessionsPath(projectPath), []);
    await this.ensureContext(projectPath);
  }

  async loadTasks(projectPath: string) {
    await this.ensureProjectState(projectPath);
    return this.readJson<AgentTask[]>(this.tasksPath(projectPath), []);
  }

  async peekTasks(projectPath: string) {
    await this.ensureProjectState(projectPath);
    return this.readJson<AgentTask[]>(this.tasksPath(projectPath), []);
  }

  async saveTasks(projectPath: string, tasks: AgentTask[]) {
    await this.ensureProjectState(projectPath);
    await fs.writeFile(this.tasksPath(projectPath), `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
  }

  async recoverInterruptedTasks(projectPath: string, isActive: (taskId: string) => boolean) {
    const tasks = await this.loadTasks(projectPath);
    let changed = false;
    const recovered = tasks.map((task) => {
      if ((task.status === 'running' || task.status === 'waiting') && !isActive(task.id)) {
        changed = true;
        return {
          ...task,
          status: 'error' as const,
          error: task.error ?? 'Backend restarted while this task was active.',
          updatedAt: new Date().toISOString()
        };
      }
      return task;
    });
    if (changed) await this.saveTasks(projectPath, recovered);
    return recovered;
  }

  async loadSessions(projectPath: string) {
    await this.ensureProjectState(projectPath);
    return this.readJson<AgentSession[]>(this.sessionsPath(projectPath), []);
  }

  async saveSessions(projectPath: string, sessions: AgentSession[]) {
    await this.ensureProjectState(projectPath);
    await fs.writeFile(this.sessionsPath(projectPath), `${JSON.stringify(sessions, null, 2)}\n`, 'utf8');
  }

  createTask(projectName: string, agentId: string, prompt: string): AgentTask {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      projectName,
      agentId,
      prompt,
      status: 'queued',
      createdAt: now,
      updatedAt: now
    };
  }

  async readContext(projectPath: string) {
    await this.ensureContext(projectPath);
    return fs.readFile(this.contextPath(projectPath), 'utf8');
  }

  async appendLog(projectPath: string, taskId: string, data: string) {
    await fs.mkdir(this.logsDir(projectPath), { recursive: true });
    await fs.appendFile(this.logPath(projectPath, taskId), data, 'utf8');
  }

  async readLog(projectPath: string, taskId: string) {
    return fs.readFile(this.logPath(projectPath, taskId), 'utf8').catch(() => '');
  }

  buildPrompt(context: string, task: AgentTask) {
    return `Project context:\n${context}\n\nCurrent task:\n${task.prompt}\n\nRules:\n- Work only inside the current project\n- Do not delete files unless necessary\n- After changes, briefly explain what changed\n`;
  }

  tasksPath(projectPath: string) {
    return path.join(projectPath, '.vibeide', 'agents', 'tasks.json');
  }

  sessionsPath(projectPath: string) {
    return path.join(projectPath, '.vibeide', 'agents', 'sessions.json');
  }

  logsDir(projectPath: string) {
    return path.join(projectPath, '.vibeide', 'agents', 'logs');
  }

  logPath(projectPath: string, taskId: string) {
    return path.join(this.logsDir(projectPath), `${taskId}.log`);
  }

  contextPath(projectPath: string) {
    return path.join(projectPath, '.vibeide', 'context.md');
  }

  private async ensureContext(projectPath: string) {
    const contextPath = this.contextPath(projectPath);
    try {
      await fs.access(contextPath);
    } catch {
      await fs.mkdir(path.dirname(contextPath), { recursive: true });
      await fs.writeFile(contextPath, `# Project Context\n\nProject: ${path.basename(projectPath)}\n\nRules:\n- Work only inside this project\n`, 'utf8');
    }
  }

  private async ensureJsonFile(filePath: string, fallback: unknown) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');
    }
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw.replace(/^\uFEFF/, '')) as T;
    } catch {
      return fallback;
    }
  }
}
