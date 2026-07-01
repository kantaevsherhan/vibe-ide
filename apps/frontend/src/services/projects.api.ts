import { apiRequest } from './api';

export type Project = {
  name: string;
  folderName: string;
  description?: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  activeTerminalsCount: number;
  runtime: {
    activeTerminals: number;
    runningAgents: number;
    activeTasks: number;
  };
  health: {
    gitChangedFiles: number;
    gitClean: boolean;
    gitBranch?: string | null;
    terminalStatus: 'inactive' | 'active';
    agentStatus: 'idle' | 'running' | 'waiting' | 'error';
  };
};

export type CreateProjectInput = {
  name: string;
  folderName: string;
  description?: string;
};

export const projectsApi = {
  list() {
    return apiRequest<{ projects: Project[] }>('/api/projects');
  },
  create(input: CreateProjectInput) {
    return apiRequest<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  get(projectName: string) {
    return apiRequest<{ project: Project }>(`/api/projects/${encodeURIComponent(projectName)}`);
  },
  delete(projectName: string) {
    return apiRequest<{ ok: true }>(`/api/projects/${encodeURIComponent(projectName)}`, {
      method: 'DELETE'
    });
  }
};
