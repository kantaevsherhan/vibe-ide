export type AgentStatus = 'idle' | 'running' | 'thinking' | 'waiting' | 'error' | 'finished' | 'stopped' | 'not_installed';

export type TaskStatus = 'queued' | 'running' | 'waiting' | 'done' | 'error' | 'stopped' | 'cancelled';

export interface AgentConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
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

export interface AgentTask {
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
}

export interface AgentsConfigFile {
  agents: AgentConfig[];
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
};

export type AgentWsMessage =
  | { type: 'snapshot'; sessions: AgentSession[]; tasks: AgentTask[] }
  | { type: 'agent_status'; session: AgentSession }
  | { type: 'agent_task'; task: AgentTask }
  | { type: 'agent_output'; taskId: string; agentId: string; data: string }
  | { type: 'agent_error'; taskId?: string; agentId?: string; message: string };
