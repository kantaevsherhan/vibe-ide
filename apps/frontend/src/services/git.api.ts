import { apiRequest } from './api';
import type { GitFileStatus } from '../types/git';

export const gitApi = {
  async status(projectName: string) {
    return apiRequest<{ files: GitFileStatus[] }>(`/api/git/status?projectName=${encodeURIComponent(projectName)}`);
  },
  async diff(projectName: string, path: string) {
    return apiRequest<{ diff: string }>(
      `/api/git/diff?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}`
    );
  }
};
