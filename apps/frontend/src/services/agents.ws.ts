import type { AgentWsMessage } from '../types/agents';
import { wsUrl } from './api';

export class AgentsSocket {
  private socket?: WebSocket;
  private projectName?: string;
  private messageHandler?: (message: AgentWsMessage) => void;
  private reconnectTimer?: number;
  private reconnectAttempts = 0;

  connect(projectName: string, onMessage: (message: AgentWsMessage) => void) {
    this.messageHandler = onMessage;
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED && this.projectName === projectName) return;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) this.socket.close();
    this.projectName = projectName;
    this.open();
  }

  private open() {
    if (!this.projectName) return;
    window.clearTimeout(this.reconnectTimer);
    this.socket = new WebSocket(wsUrl(`/ws/agents?projectName=${encodeURIComponent(this.projectName)}`));
    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
    });
    this.socket.addEventListener('message', (event) => this.messageHandler?.(JSON.parse(event.data)));
    this.socket.addEventListener('error', (event) => {
      console.warn('[ws:agents] connection error', event);
    });
    this.socket.addEventListener('close', (event) => {
      console.warn('[ws:agents] closed', { code: event.code, reason: event.reason });
      this.socket = undefined;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (!this.projectName) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    this.reconnectAttempts += 1;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.open(), delay);
  }
}
