import { apiRequest } from './api';

export type SystemUpdateResult = {
  updated: boolean;
  message: string;
  logs: string[];
};

export const systemApi = {
  checkUpdate() {
    return apiRequest<SystemUpdateResult>('/api/system/check-update', {
      method: 'POST'
    });
  }
};
