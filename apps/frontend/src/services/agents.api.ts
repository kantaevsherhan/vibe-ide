import { apiRequest } from './api';
import type { AgentListItem, AgentSession, AgentTask } from '../types/agents';

export const agentsApi = {
  list() {
    return apiRequest<{ agents: AgentListItem[] }>('/api/agents');
  },
  status(projectName: string) {
    return apiRequest<{ agents: AgentListItem[]; sessions: AgentSession[]; tasks: AgentTask[] }>(
      `/api/agents/status?projectName=${encodeURIComponent(projectName)}`
    );
  },
  tasks(projectName: string) {
    return apiRequest<{ tasks: AgentTask[] }>(`/api/agents/tasks?projectName=${encodeURIComponent(projectName)}`);
  },
  createTask(projectName: string, agentId: string, prompt: string) {
    return apiRequest<{ task: AgentTask }>('/api/agents/tasks', {
      method: 'POST',
      body: JSON.stringify({ projectName, agentId, prompt })
    });
  },
  cancel(taskId: string) {
    return apiRequest<{ task: AgentTask }>(`/api/agents/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' });
  },
  retry(taskId: string) {
    return apiRequest<{ task: AgentTask }>(`/api/agents/tasks/${encodeURIComponent(taskId)}/retry`, { method: 'POST' });
  },
  move(taskId: string, direction: 'up' | 'down') {
    return apiRequest<{ task: AgentTask }>(`/api/agents/tasks/${encodeURIComponent(taskId)}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction })
    });
  },
  log(taskId: string) {
    return apiRequest<{ log: string }>(`/api/agents/tasks/${encodeURIComponent(taskId)}/log`);
  }
};
