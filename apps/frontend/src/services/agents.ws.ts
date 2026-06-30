import type { AgentWsMessage } from '../types/agents';

export class AgentsSocket {
  private socket?: WebSocket;
  private projectName?: string;
  private messageHandler?: (message: AgentWsMessage) => void;

  connect(projectName: string, onMessage: (message: AgentWsMessage) => void) {
    this.messageHandler = onMessage;
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED && this.projectName === projectName) return;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) this.socket.close();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.projectName = projectName;
    this.socket = new WebSocket(`${protocol}://${window.location.host}/ws/agents?projectName=${encodeURIComponent(projectName)}`);
    this.socket.addEventListener('message', (event) => this.messageHandler?.(JSON.parse(event.data)));
    this.socket.addEventListener('close', () => {
      this.socket = undefined;
    });
  }
}
