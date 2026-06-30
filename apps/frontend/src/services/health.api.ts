import { apiRequest } from './api';
import type { WorkspaceHealthResponse } from '../types/health';

export const healthApi = {
  workspace(projectName: string) {
    return apiRequest<WorkspaceHealthResponse>(`/api/workspace/health?projectName=${encodeURIComponent(projectName)}`);
  }
};
