import os from 'node:os';
import pty, { type IPty } from 'node-pty';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { TerminalMessage, TerminalOutputMessage, TerminalSnapshot } from '../../types/terminal.js';
import { ensureTerminalAllowed } from '../security/permissions.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

type SendMessage = (message: TerminalOutputMessage) => void;
type TerminalSessionState = {
  id: string;
  name: string;
  output: string;
  createdAt: number;
  pty: IPty;
};

export class TerminalService {
  private readonly sessions = new Map<string, TerminalSessionState>();
  private readonly clients = new Set<SendMessage>();

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly config: VibeIdeConfig
  ) {}

  handle(message: TerminalMessage, send: SendMessage) {
    ensureTerminalAllowed(this.config);
    if (message.type === 'create') {
      this.create(message.terminalId);
      return;
    }

    const session = this.sessions.get(message.terminalId);
    if (!session) {
      send({ type: 'error', terminalId: message.terminalId, message: 'Terminal was not found.' });
      return;
    }

    if (message.type === 'input') session.pty.write(message.data);
    if (message.type === 'resize') session.pty.resize(message.cols, message.rows);
    if (message.type === 'close') this.closeById(message.terminalId);
  }

  attach(send: SendMessage) {
    ensureTerminalAllowed(this.config);
    this.clients.add(send);
    send({ type: 'snapshot', sessions: this.list() });
  }

  detach(send: SendMessage) {
    this.clients.delete(send);
  }

  list(): TerminalSnapshot[] {
    ensureTerminalAllowed(this.config);
    return [...this.sessions.values()].map((session) => this.snapshot(session));
  }

  closeById(terminalId: string) {
    const session = this.sessions.get(terminalId);
    if (!session) return;

    session.pty.kill();
    this.sessions.delete(terminalId);
    this.broadcast({ type: 'closed', terminalId });
  }

  private create(terminalId: string) {
    if (this.sessions.has(terminalId)) {
      this.broadcast({ type: 'snapshot', sessions: this.list() });
      return;
    }

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const terminal = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 100,
      rows: 28,
      cwd: this.workspace.root,
      env: process.env
    });

    const session: TerminalSessionState = {
      id: terminalId,
      name: `term ${this.sessions.size + 1}`,
      output: '',
      createdAt: Date.now(),
      pty: terminal
    };

    this.sessions.set(terminalId, session);
    this.broadcast({ type: 'created', session: this.snapshot(session) });

    terminal.onData((data) => {
      session.output += data;
      this.broadcast({ type: 'output', terminalId, data });
    });
    terminal.onExit(() => {
      this.sessions.delete(terminalId);
      this.broadcast({ type: 'closed', terminalId });
    });
  }

  private snapshot(session: TerminalSessionState): TerminalSnapshot {
    return {
      id: session.id,
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
}
