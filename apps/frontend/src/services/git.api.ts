import { apiRequest } from './api';
import type { GitBranchesResponse, GitStatusResponse } from '../types/git';

export const gitApi = {
  async status(projectName: string) {
    return apiRequest<GitStatusResponse>(`/api/git/status?projectName=${encodeURIComponent(projectName)}`);
  },
  async init(projectName: string) {
    return apiRequest<GitStatusResponse>('/api/git/init', {
      method: 'POST',
      body: JSON.stringify({ projectName })
    });
  },
  async diff(projectName: string, path: string) {
    return apiRequest<{ diff: string }>(
      `/api/git/diff?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}`
    );
  },
  async branches(projectName: string) {
    return apiRequest<GitBranchesResponse>(`/api/git/branches?projectName=${encodeURIComponent(projectName)}`);
  },
  async checkout(projectName: string, branch: string) {
    return apiRequest<GitBranchesResponse>('/api/git/checkout', {
      method: 'POST',
      body: JSON.stringify({ projectName, branch })
    });
  }
};
