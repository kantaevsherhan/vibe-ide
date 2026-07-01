export type UpdateJobStatus = 'idle' | 'checking' | 'updating' | 'installing' | 'building' | 'done' | 'error';

export interface UpdateJob {
  jobId: string;
  status: UpdateJobStatus;
  message: string;
  startedAt: string;
  finishedAt?: string;
  hasUpdates?: boolean;
  error?: string;
  logPath: string;
}

export type StartUpdateResponse = {
  jobId: string;
  status: 'running';
  message: string;
};

export type UpdateStatusResponse = Omit<UpdateJob, 'logPath'>;

export type UpdateLogsResponse = {
  jobId: string;
  logs: string;
};
