import { apiRequest } from './api';
import type { GitStatusResponse } from '../types/git';

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
  }
};
