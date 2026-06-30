import os from 'node:os';
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
  private readonly clients = new Set<SendMessage>();

  constructor(
    private readonly projects: ProjectsService,
    private readonly config: VibeIdeConfig
  ) {}

  async handle(message: TerminalMessage, send: SendMessage) {
    ensureTerminalAllowed(this.config);
    await this.projects.ensureProjectExists(message.projectName);

    if (message.type === 'create') {
      await this.create(message.projectName, message.terminalId);
      return;
    }

    const session = this.projectSessions(message.projectName).get(message.terminalId);
    if (!session) {
      send({ type: 'error', terminalId: message.terminalId, message: 'Terminal was not found.' });
      return;
    }

    if (message.type === 'input') session.pty.write(message.data);
    if (message.type === 'resize') session.pty.resize(message.cols, message.rows);
    if (message.type === 'close') this.closeById(message.terminalId);
  }

  attach(projectName: string, send: SendMessage) {
    ensureTerminalAllowed(this.config);
    this.projects.assertProjectName(projectName);
    this.clients.add(send);
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
    return {
      terminals: this.list(projectName).map((terminal, index) => ({
        terminalId: terminal.id,
        title: terminal.name,
        createdAt: new Date(terminal.createdAt).toISOString(),
        isActive: index === this.list(projectName).length - 1,
        buffer: terminal.output
      }))
    };
  }

  count(projectName: string) {
    this.projects.assertProjectName(projectName);
    return this.projectSessions(projectName).size;
  }

  closeById(terminalId: string) {
    const session = this.findSession(terminalId);
    if (!session) return;

    session.pty.kill();
    this.projectSessions(session.projectName).delete(terminalId);
    this.broadcast({ type: 'closed', terminalId });
  }

  private async create(projectName: string, terminalId: string) {
    const projectSessions = this.projectSessions(projectName);
    if (projectSessions.has(terminalId)) {
      this.broadcast({ type: 'snapshot', sessions: this.list(projectName) });
      return;
    }

    const projectPath = await this.projects.ensureProjectExists(projectName);
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
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
      name: `term ${projectSessions.size + 1}`,
      output: '',
      createdAt: Date.now(),
      pty: terminal
    };

    projectSessions.set(terminalId, session);
    this.broadcast({ type: 'created', session: this.snapshot(session) });

    terminal.onData((data) => {
      session.output = this.trimBuffer(session.output + data);
      this.broadcast({ type: 'output', terminalId, data });
    });
    terminal.onExit(() => {
      projectSessions.delete(terminalId);
      this.broadcast({ type: 'closed', terminalId });
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

  private broadcast(message: TerminalOutputMessage) {
    for (const send of this.clients) {
      send(message);
    }
  }

  private projectSessions(projectName: string) {
    const existing = this.sessions.get(projectName);
    if (existing) return existing;

    const sessions = new Map<string, TerminalSessionState>();
    this.sessions.set(projectName, sessions);
    return sessions;
  }

  private findSession(terminalId: string) {
    for (const sessions of this.sessions.values()) {
      const session = sessions.get(terminalId);
      if (session) return session;
    }
    return null;
  }

  private trimBuffer(output: string) {
    const lines = output.split(/\r?\n/);
    if (lines.length <= 5000) return output;
    return lines.slice(-5000).join('\n');
  }
}
