import os from 'node:os';
import { existsSync } from 'node:fs';
import pty, { type IPty } from 'node-pty';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { TerminalMessage, TerminalOutputMessage, TerminalSnapshot } from '../../types/terminal.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { ensureTerminalAllowed } from '../security/permissions.js';

type SendMessage = (message: TerminalOutputMessage) => void;
type TerminalSessionState = {
  id: string;
  projectName: string;
  name: string;
  output: string;
  createdAt: number;
  pty: IPty;
};

export class TerminalService {
  private readonly sessions = new Map<string, Map<string, TerminalSessionState>>();
  private readonly clients = new Map<SendMessage, string>();

  constructor(
    private readonly projects: ProjectsService,
    private readonly config: VibeIdeConfig
  ) {}

  async handle(message: TerminalMessage, send: SendMessage) {
    ensureTerminalAllowed(this.config);
    await this.projects.ensureProjectExists(message.projectName);

    try {
      if (message.type === 'create') {
        await this.create(message.projectName, message.terminalId, message.name);
        return;
      }

      const session = this.projectSessions(message.projectName).get(message.terminalId);
      if (!session) {
        send({ type: 'error', terminalId: message.terminalId, message: 'Terminal was not found.' });
        return;
      }

      if (message.type === 'input') session.pty.write(message.data);
      if (message.type === 'resize') session.pty.resize(message.cols, message.rows);
      if (message.type === 'close') this.close(message.projectName, message.terminalId);
    } catch (error) {
      send({
        type: 'error',
        terminalId: message.terminalId,
        message: error instanceof Error ? error.message : 'Terminal command failed.'
      });
    }
  }

  async attach(projectName: string, send: SendMessage) {
    ensureTerminalAllowed(this.config);
    await this.projects.ensureProjectExists(projectName);
    this.clients.set(send, projectName);
    send({ type: 'snapshot', sessions: this.list(projectName) });
  }

  detach(send: SendMessage) {
    this.clients.delete(send);
  }

  list(projectName: string): TerminalSnapshot[] {
    ensureTerminalAllowed(this.config);
    this.projects.assertProjectName(projectName);
    return [...this.projectSessions(projectName).values()].map((session) => this.snapshot(session));
  }

  listApi(projectName: string) {
    const terminals = this.list(projectName);
    return {
      terminals: terminals.map((terminal, index) => ({
        terminalId: terminal.id,
        title: terminal.name,
        createdAt: new Date(terminal.createdAt).toISOString(),
        isActive: index === terminals.length - 1,
        buffer: terminal.output
      }))
    };
  }

  count(projectName: string) {
    this.projects.assertProjectName(projectName);
    return this.projectSessions(projectName).size;
  }

  close(projectName: string, terminalId: string) {
    const session = this.projectSessions(projectName).get(terminalId);
    if (!session) return;

    session.pty.kill();
    this.projectSessions(projectName).delete(terminalId);
    this.broadcast(projectName, { type: 'closed', terminalId });
  }

  closeProject(projectName: string) {
    const sessions = this.projectSessions(projectName);
    const terminalIds = [...sessions.keys()];
    for (const terminalId of terminalIds) {
      const session = sessions.get(terminalId);
      if (session) session.pty.kill();
      sessions.delete(terminalId);
      this.broadcast(projectName, { type: 'closed', terminalId });
    }
  }

  private async create(projectName: string, terminalId: string, name?: string) {
    const projectSessions = this.projectSessions(projectName);
    if (projectSessions.has(terminalId)) {
      this.broadcast(projectName, { type: 'snapshot', sessions: this.list(projectName) });
      return;
    }

    const projectPath = await this.projects.ensureProjectExists(projectName);
    const shell = this.resolveShell();
    const terminal = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 100,
      rows: 28,
      cwd: projectPath,
      env: process.env
    });

    const session: TerminalSessionState = {
      id: terminalId,
      projectName,
      name: this.normalizeName(name) || `term ${projectSessions.size + 1}`,
      output: '',
      createdAt: Date.now(),
      pty: terminal
    };

    projectSessions.set(terminalId, session);
    this.broadcast(projectName, { type: 'created', session: this.snapshot(session) });

    terminal.onData((data) => {
      session.output = this.trimBuffer(session.output + data);
      this.broadcast(projectName, { type: 'output', terminalId, data });
    });
    terminal.onExit(() => {
      projectSessions.delete(terminalId);
      this.broadcast(projectName, { type: 'closed', terminalId });
    });
  }

  private snapshot(session: TerminalSessionState): TerminalSnapshot {
    return {
      id: session.id,
      projectName: session.projectName,
      name: session.name,
      output: session.output,
      createdAt: session.createdAt
    };
  }

  private broadcast(projectName: string, message: TerminalOutputMessage) {
    for (const [send, clientProjectName] of this.clients) {
      if (clientProjectName === projectName) send(message);
    }
  }

  private projectSessions(projectName: string) {
    const existing = this.sessions.get(projectName);
    if (existing) return existing;

    const sessions = new Map<string, TerminalSessionState>();
    this.sessions.set(projectName, sessions);
    return sessions;
  }

  private trimBuffer(output: string) {
    const lines = output.split(/\r?\n/);
    if (lines.length <= 5000) return output;
    return lines.slice(-5000).join('\n');
  }

  private normalizeName(name: string | undefined) {
    return name?.trim().replace(/\s+/g, ' ').slice(0, 48) ?? '';
  }

  private resolveShell() {
    if (os.platform() === 'win32') return process.env.COMSPEC ?? 'powershell.exe';
    if (process.env.SHELL) return process.env.SHELL;
    if (existsSync('/bin/bash')) return '/bin/bash';
    return '/bin/sh';
  }
}
