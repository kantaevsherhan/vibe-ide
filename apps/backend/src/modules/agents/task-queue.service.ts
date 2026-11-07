import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentSession, AgentTask } from './agents.types.js';
import { writeAtomicJson } from '../security/atomic-json.js';

const ansiPattern =
  /(?:\u001B\][\s\S]*?(?:\u0007|\u001B\\))|(?:[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])))/g;

export class TaskQueueService {
  private readonly writes = new Map<string, Promise<void>>();

  private async serialized<T>(file: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.writes.get(file) ?? Promise.resolve();
    const pending = previous.then(operation);
    const tail = pending.then(() => {}, () => {});
    this.writes.set(file, tail);
    try {
      return await pending;
    } finally {
      if (this.writes.get(file) === tail) this.writes.delete(file);
    }
  }

  async mutateTasks<T>(projectPath: string, update: (tasks: AgentTask[]) => T) {
    return this.serialized(this.tasksPath(projectPath), async () => {
      const tasks = await this.loadTasks(projectPath);
      const before = JSON.stringify(tasks);
      const result = update(tasks);
      if (JSON.stringify(tasks) !== before) await writeAtomicJson(this.tasksPath(projectPath), tasks);
      return result;
    });
  }

  async mutateSessions(projectPath: string, update: (sessions: AgentSession[]) => void) {
    return this.serialized(this.sessionsPath(projectPath), async () => {
      const sessions = await this.loadSessions(projectPath);
      const before = JSON.stringify(sessions);
      update(sessions);
      if (JSON.stringify(sessions) !== before) await writeAtomicJson(this.sessionsPath(projectPath), sessions);
    });
  }

  async ensureProjectState(projectPath: string) {
    await fs.mkdir(this.logsDir(projectPath), { recursive: true });
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

  async recoverInterruptedTasks(projectPath: string, isActive: (taskId: string) => boolean) {
    const recovered = await this.mutateTasks(projectPath, (tasks) => {
      for (const task of tasks) {
        if ((task.status === 'running' || task.status === 'waiting') && !isActive(task.id)) {
          Object.assign(task, {
            status: 'error',
            error: task.error ?? 'Backend restarted while this task was active.',
            updatedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString()
          });
        }
      }
      return tasks;
    });
    await this.mutateSessions(projectPath, (sessions) => {
      for (const session of sessions) {
        if (session.currentTaskId && !isActive(session.currentTaskId) && ['running', 'waiting', 'thinking'].includes(session.status)) {
          session.status = 'error';
          session.updatedAt = new Date().toISOString();
        }
      }
    });
    return recovered;
  }

  async loadSessions(projectPath: string) {
    await this.ensureProjectState(projectPath);
    return this.readJson<AgentSession[]>(this.sessionsPath(projectPath), []);
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

  async writePromptFile(projectPath: string, taskId: string, prompt: string) {
    const promptPath = path.join(projectPath, '.vibeide', 'agents', 'prompts', `${taskId}.md`);
    await fs.mkdir(path.dirname(promptPath), { recursive: true });
    await fs.writeFile(promptPath, prompt, 'utf8');
    return promptPath;
  }

  async readLog(projectPath: string, taskId: string) {
    const raw = await fs.readFile(this.logPath(projectPath, taskId), 'utf8').catch(() => '');
    return this.cleanOutput(raw);
  }

  buildPrompt(context: string, task: AgentTask, projectPath: string) {
    return `Project context:\n${context}\n\nProject root:\n${projectPath}\n\nCurrent task:\n${task.prompt}\n\nRules:\n- You have full read/write access only inside the current project directory: ${projectPath}\n- Treat ${projectPath} as the workspace boundary\n- Do not access, inspect, edit, create, move, copy, or delete files outside ${projectPath}\n- Do not run commands from outside ${projectPath}\n- Do not use absolute paths unless they point inside ${projectPath}\n- If a task requires files outside ${projectPath}, stop and explain that it is outside the allowed project scope\n- Do not delete files unless necessary\n- After changes, briefly explain what changed\n`;
  }

  cleanOutput(output: string) {
    return output.replace(ansiPattern, '');
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
    await fs.mkdir(path.dirname(contextPath), { recursive: true });
    await fs.writeFile(contextPath, `# Project Context\n\nProject: ${path.basename(projectPath)}\n\nRules:\n- Work only inside this project\n`, { flag: 'wx' })
      .catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw.replace(/^\uFEFF/, '')) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
      throw error;
    }
  }
}
