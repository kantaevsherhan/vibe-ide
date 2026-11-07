export type AgentStatus = 'idle' | 'running' | 'thinking' | 'waiting' | 'error' | 'finished' | 'stopped' | 'not_installed';

export type TaskStatus = 'queued' | 'running' | 'waiting' | 'done' | 'error' | 'stopped' | 'cancelled';

export interface RunOptions {
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export interface TaskOptions {
  run?: RunOptions;
  reviewer?: RunOptions & { agentId: 'codex' | 'claude' };
}

export interface CreateAgentTaskInput extends TaskOptions {
  projectName: string;
  agentId: string;
  prompt: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  inputMode?: 'stdin' | 'argument' | 'file';
  timeoutMs?: number;
  transport?: 'api';
}

export interface AgentSession {
  id: string;
  agentId: string;
  projectName: string;
  status: AgentStatus;
  currentTaskId?: string;
  startedAt: string;
  updatedAt: string;
  lastOutput?: string;
}

export interface AgentTask extends TaskOptions {
  id: string;
  projectName: string;
  agentId: string;
  prompt: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  reviewOf?: string;
  reviewTaskId?: string;
  source?: { kind: 'chronos' | 'warmup'; key: string; title: string };
}

export interface WarmupConfig {
  projectName: string;
  time: string;
  timeZone: string;
  agents: ('codex' | 'claude')[];
}

export interface ChronosConfig extends TaskOptions {
  enabled: boolean;
  url: string;
  token: string;
  projectName: string;
  agentId: 'codex' | 'claude';
}

export interface AgentsConfigFile {
  models: Record<'api' | 'ollama', { model: string; baseUrl: string; apiKey: string; keyConfigured?: boolean }>;
  agents: AgentConfig[];
  warmup: WarmupConfig;
  chronos: ChronosConfig;
  notifications: {
    telegram: {
      enabled: boolean;
      botToken: string;
      chatId: string;
    };
  };
}

export type AgentListItem = AgentConfig & {
  installed: boolean;
  status: AgentStatus;
  resolvedCommand?: string;
  lastError?: string;
};

export type AgentWsMessage =
  | { type: 'snapshot'; sessions: AgentSession[]; tasks: AgentTask[] }
  | { type: 'agent_status'; session: AgentSession }
  | { type: 'agent_task'; task: AgentTask }
  | { type: 'agent_output'; taskId: string; agentId: string; data: string }
  | { type: 'agent_error'; taskId?: string; agentId?: string; message: string };
