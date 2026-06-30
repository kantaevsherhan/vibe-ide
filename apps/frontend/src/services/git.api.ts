import { apiRequest } from './api';
import type { GitFileStatus } from '../types/git';

export const gitApi = {
  async status() {
    return apiRequest<{ files: GitFileStatus[] }>('/api/git/status');
  },
  async diff(path: string) {
    return apiRequest<{ diff: string }>(`/api/git/diff?path=${encodeURIComponent(path)}`);
  }
};
