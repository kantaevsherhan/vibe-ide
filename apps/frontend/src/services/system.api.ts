import { apiRequest } from './api';

export type UpdateJobStatus = 'idle' | 'checking' | 'updating' | 'installing' | 'building' | 'done' | 'error';

export type StartUpdateResponse = {
  jobId: string;
  status: 'running';
  message: string;
};

export type UpdateStatusResponse = {
  jobId: string;
  status: UpdateJobStatus;
  message: string;
  startedAt: string;
  finishedAt?: string;
  hasUpdates?: boolean;
  error?: string;
};

export const systemApi = {
  startUpdate() {
    return apiRequest<StartUpdateResponse>('/api/system/update/start', {
      method: 'POST'
    });
  },
  updateStatus(jobId: string) {
    return apiRequest<UpdateStatusResponse>(`/api/system/update/status/${encodeURIComponent(jobId)}`);
  },
  updateLogs(jobId: string) {
    return apiRequest<{ jobId: string; logs: string }>(`/api/system/update/logs/${encodeURIComponent(jobId)}`);
  }
};
