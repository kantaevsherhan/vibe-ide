import { apiRequest } from './api';
import type { AgentConfig, TaskOptions } from '../types/agents';

export type ThemeName = 'dark' | 'light';

export type LocalSettings = {
  theme: ThemeName;
  fontSize: number;
  fontFamily: string;
};

export type ServerSettings = {
  models: Record<'api' | 'ollama', { model: string; baseUrl: string; apiKey: string; keyConfigured?: boolean }>;
  warmup: { projectName: string; time: string; timeZone: string; agents: ('codex' | 'claude')[] };
  chronos: TaskOptions & { enabled: boolean; url: string; token: string; tokenConfigured?: boolean; projectName: string; agentId: 'codex' | 'claude' };
  agents: AgentConfig[];
  notifications: {
    telegram: {
      enabled: boolean;
      botToken: string;
      chatId: string;
    };
  };
  workspace: {
    path: string;
    readOnly: boolean;
    autoIgnore: boolean;
  };
};

export type UpdateServerSettingsInput = Partial<{
  models: ServerSettings['models'];
  warmup: ServerSettings['warmup'];
  chronos: ServerSettings['chronos'];
  agents: AgentConfig[];
  notifications: Partial<{
    telegram: Partial<ServerSettings['notifications']['telegram']>;
  }>;
}>;

export const settingsApi = {
  get() {
    return apiRequest<{ settings: ServerSettings }>('/api/settings');
  },
  update(input: UpdateServerSettingsInput) {
    return apiRequest<{ settings: ServerSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(input)
    });
  },
  testTelegram(input: Partial<ServerSettings['notifications']['telegram']>) {
    return apiRequest<{ ok: true; message: string }>('/api/settings/test-telegram', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }
};
