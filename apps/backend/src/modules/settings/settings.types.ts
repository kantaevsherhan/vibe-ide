import type { AgentConfig, AgentsConfigFile, ChronosConfig, WarmupConfig } from '../agents/agents.types.js';

export type ServerSettings = {
  models: AgentsConfigFile['models'];
  warmup: WarmupConfig;
  chronos: ChronosConfig & { tokenConfigured?: boolean };
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
  models: AgentsConfigFile['models'];
  warmup: WarmupConfig;
  chronos: ChronosConfig;
  agents: AgentConfig[];
  notifications: Partial<{
    telegram: Partial<ServerSettings['notifications']['telegram']>;
  }>;
}>;

export type TestTelegramInput = Partial<ServerSettings['notifications']['telegram']>;
