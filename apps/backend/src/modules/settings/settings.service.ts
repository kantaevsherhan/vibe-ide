import type { AgentsConfigService } from '../agents/agents.config.js';
import type { TelegramService } from '../agents/telegram.service.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { ServerSettings, TestTelegramInput, UpdateSettingsInput } from './settings.types.js';

export class SettingsService {
  constructor(
    private readonly agentsConfig: AgentsConfigService,
    private readonly workspace: WorkspaceService,
    private readonly config: VibeIdeConfig,
    private readonly telegram: TelegramService
  ) {}

  get(): ServerSettings {
    const agents = this.agentsConfig.value;
    return {
      agents: agents.agents,
      notifications: agents.notifications,
      workspace: {
        path: this.workspace.root,
        readOnly: false,
        autoIgnore: this.config.ignore.enabled
      }
    };
  }

  async update(input: UpdateSettingsInput) {
    const currentTelegram = this.agentsConfig.value.notifications.telegram;
    await this.agentsConfig.update({
      agents: input.agents,
      notifications: input.notifications
        ? {
            telegram: {
              ...currentTelegram,
              ...input.notifications.telegram
            }
          }
        : undefined
    });

    return this.get();
  }

  async testTelegram(input: TestTelegramInput) {
    const current = this.agentsConfig.value.notifications.telegram;
    const next = {
      enabled: input.enabled ?? current.enabled,
      botToken: input.botToken ?? current.botToken,
      chatId: input.chatId ?? current.chatId
    };

    if (!next.botToken || !next.chatId) {
      throw Object.assign(new Error('Telegram Bot Token and Chat ID are required.'), { statusCode: 400 });
    }

    try {
      await this.telegram.sendTelegramMessage('Hello from VibeIDE 👋', { ...next, enabled: true });
    } catch (error) {
      throw Object.assign(new Error('Failed to send Telegram notification.'), { statusCode: 400, cause: error });
    }

    return { ok: true, message: 'Notification sent successfully.' };
  }
}
