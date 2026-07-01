import type { AgentConfig } from '../agents/agents.types.js';

export type ServerSettings = {
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

export type UpdateSettingsInput = Partial<{
  agents: AgentConfig[];
  notifications: Partial<{
    telegram: Partial<ServerSettings['notifications']['telegram']>;
  }>;
}>;

export type TestTelegramInput = Partial<ServerSettings['notifications']['telegram']>;
