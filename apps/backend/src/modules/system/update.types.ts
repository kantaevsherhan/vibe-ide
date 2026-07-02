export type UpdateJobStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'building'
  | 'waiting_restart'
  | 'restarting'
  | 'finished'
  | 'failed';

export type RuntimeKind = 'manual' | 'pm2' | 'systemd' | 'docker' | 'unknown';

export type RuntimeInfo = {
  runtime: RuntimeKind;
  service?: string;
  processName?: string;
  source: 'config' | 'detected' | 'default';
};

export type UpdateStrategy = 'cancel' | 'stash' | 'force';

export interface UpdateJob {
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
  logPath: string;
}

export type StartUpdateResponse = {
  jobId: string;
  status: 'running';
  message: string;
};

export type StartUpdateInput = {
  strategy?: UpdateStrategy;
};

export type UpdateStatusResponse = Omit<UpdateJob, 'logPath'>;

export type UpdateLogsResponse = {
  jobId: string;
  logs: string;
};
