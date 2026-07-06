import type { TerminalMessage, TerminalOutputMessage } from '../types/terminal';
import { wsUrl } from './api';

export class TerminalSocket {
  private socket?: WebSocket;
  private queue: TerminalMessage[] = [];
  private messageHandler?: (message: TerminalOutputMessage) => void;
  private projectName?: string;
  private reconnectTimer?: number;
  private reconnectAttempts = 0;

  connect(projectName: string, onMessage: (message: TerminalOutputMessage) => void) {
    this.messageHandler = onMessage;
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED && this.projectName === projectName) return;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    this.projectName = projectName;
    this.queue = [];
    this.open();
  }

  private open() {
    if (!this.projectName) return;
    window.clearTimeout(this.reconnectTimer);
    const nextUrl = wsUrl(`/ws/terminal?projectName=${encodeURIComponent(this.projectName)}`);
    this.socket = new WebSocket(nextUrl);
    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      for (const message of this.queue.splice(0)) this.send(message);
    });
    this.socket.addEventListener('message', (event) => this.messageHandler?.(JSON.parse(event.data)));
    this.socket.addEventListener('error', (event) => {
      console.warn('[ws:terminal] connection error', event);
    });
    this.socket.addEventListener('close', (event) => {
      console.warn('[ws:terminal] closed', { code: event.code, reason: event.reason });
      this.socket = undefined;
      this.scheduleReconnect();
    });
  }

  send(message: TerminalMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    this.queue.push(message);
  }

  private scheduleReconnect() {
    if (!this.projectName) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    this.reconnectAttempts += 1;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.open(), delay);
  }
}
