export type TerminalMessage =
  | { type: 'create'; terminalId: string }
  | { type: 'input'; terminalId: string; data: string }
  | { type: 'resize'; terminalId: string; cols: number; rows: number }
  | { type: 'close'; terminalId: string };

export type TerminalOutputMessage =
  | { type: 'snapshot'; sessions: TerminalSnapshot[] }
  | { type: 'created'; session: TerminalSnapshot }
  | { type: 'output'; terminalId: string; data: string }
  | { type: 'closed'; terminalId: string }
  | { type: 'error'; terminalId: string; message: string };

export type TerminalSnapshot = {
  id: string;
  name: string;
  output: string;
  createdAt: number;
};
