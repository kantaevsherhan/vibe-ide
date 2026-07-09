export type TerminalMessage =
  | { type: 'create'; projectName: string; terminalId: string; name?: string }
  | { type: 'input'; projectName: string; terminalId: string; data: string }
  | { type: 'resize'; projectName: string; terminalId: string; cols: number; rows: number }
  | { type: 'close'; projectName: string; terminalId: string };

export type TerminalOutputMessage =
  | { type: 'snapshot'; sessions: TerminalSnapshot[] }
  | { type: 'created'; session: TerminalSnapshot }
  | { type: 'output'; terminalId: string; data: string }
  | { type: 'closed'; terminalId: string }
  | { type: 'error'; terminalId: string; message: string };

export type TerminalSnapshot = {
  id: string;
  projectName: string;
  name: string;
  output: string;
  createdAt: number;
};
