import type { TerminalMessage, TerminalOutputMessage } from '../types/terminal';

export class TerminalSocket {
  private socket?: WebSocket;
  private queue: TerminalMessage[] = [];
  private messageHandler?: (message: TerminalOutputMessage) => void;
  private projectName?: string;

  connect(projectName: string, onMessage: (message: TerminalOutputMessage) => void) {
    this.messageHandler = onMessage;
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED && this.projectName === projectName) return;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.projectName = projectName;
    this.queue = [];
    this.socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/terminal?projectName=${encodeURIComponent(projectName)}`
    );
    this.socket.addEventListener('open', () => {
      for (const message of this.queue.splice(0)) this.send(message);
    });
    this.socket.addEventListener('message', (event) => this.messageHandler?.(JSON.parse(event.data)));
    this.socket.addEventListener('close', () => {
      this.socket = undefined;
    });
  }

  send(message: TerminalMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    this.queue.push(message);
  }
}
