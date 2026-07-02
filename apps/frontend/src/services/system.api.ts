import { apiRequest } from './api';

export type UpdateJobStatus = 'idle' | 'checking' | 'downloading' | 'installing' | 'building' | 'waiting_restart' | 'restarting' | 'finished' | 'failed';
export type UpdateStrategy = 'cancel' | 'stash' | 'force';
export type RuntimeInfo = {
  runtime: 'manual' | 'pm2' | 'systemd' | 'docker' | 'unknown';
  service?: string;
  processName?: string;
  source: 'config' | 'detected' | 'default';
};

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
  currentVersion?: string;
  latestVersion?: string;
  runtime?: RuntimeInfo;
  restartStatus?: string;
  error?: string;
};

export const systemApi = {
  runtime() {
    return apiRequest<RuntimeInfo>('/api/system/runtime');
  },
  startUpdate(strategy: UpdateStrategy = 'cancel') {
    return apiRequest<StartUpdateResponse>('/api/system/update', {
      method: 'POST',
      body: JSON.stringify({ strategy })
    });
  },
  updateStatus(jobId: string) {
    return apiRequest<UpdateStatusResponse>(`/api/system/update/status/${encodeURIComponent(jobId)}`);
  },
  updateLogs(jobId: string) {
    return apiRequest<{ jobId: string; logs: string }>(`/api/system/update/logs/${encodeURIComponent(jobId)}`);
  }
};
