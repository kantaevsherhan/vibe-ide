import type { AgentsConfigService } from '../agents/agents.config.js';
import type { TelegramService } from '../agents/telegram.service.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { ServerSettings, TestTelegramInput, UpdateSettingsInput } from './settings.types.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { validateTaskOptions } from '../agents/task-options.js';

export class SettingsService {
  constructor(
    private readonly agentsConfig: AgentsConfigService,
    private readonly workspace: WorkspaceService,
    private readonly config: VibeIdeConfig,
    private readonly telegram: TelegramService,
    private readonly projects: ProjectsService
  ) {}

  get(): ServerSettings {
    const agents = this.agentsConfig.value;
    return {
      agents: agents.agents,
      models: {
        api: { ...agents.models.api, apiKey: '', keyConfigured: Boolean(agents.models.api.apiKey) },
        ollama: { ...agents.models.ollama, apiKey: '', keyConfigured: Boolean(agents.models.ollama.apiKey) }
      },
      warmup: agents.warmup,
      chronos: { ...agents.chronos, token: '', tokenConfigured: Boolean(agents.chronos.token) },
      notifications: agents.notifications,
      workspace: {
        path: this.workspace.root,
        readOnly: false,
        autoIgnore: this.config.ignore.enabled
      }
    };
  }

  async update(input: UpdateSettingsInput) {
    if (input.models) {
      for (const model of [input.models.api, input.models.ollama]) {
        if (!model || typeof model.baseUrl !== 'string') {
          throw Object.assign(new Error('Both API and Ollama settings are required.'), { statusCode: 400 });
        }
        let url: URL;
        try { url = new URL(model.baseUrl); }
        catch { throw Object.assign(new Error('Invalid model API URL.'), { statusCode: 400 }); }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
            typeof model.model !== 'string' || typeof model.apiKey !== 'string') {
          throw Object.assign(new Error('Invalid model settings.'), { statusCode: 400 });
        }
      }
    }
    if (input.warmup) {
      const value = input.warmup;
      if (typeof value.time !== 'string' || typeof value.timeZone !== 'string' ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || !Array.isArray(value.agents) ||
          value.agents.some((id) => !['codex', 'claude'].includes(id))) {
        throw Object.assign(new Error('Choose a valid time and Codex or Claude Code.'), { statusCode: 400 });
      }
      try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).format(); }
      catch { throw Object.assign(new Error('Invalid IANA timezone.'), { statusCode: 400 }); }
      if (value.agents.length) await this.workspaceProject(value.projectName);
    }
    if (input.chronos) {
      const value = input.chronos;
      validateTaskOptions(value);
      if (typeof value.enabled !== 'boolean' || typeof value.url !== 'string' || typeof value.token !== 'string') {
        throw Object.assign(new Error('Invalid Chronos settings.'), { statusCode: 400 });
      }
      let url: URL;
      try { url = new URL(value.url); }
      catch { throw Object.assign(new Error('Invalid Chronos MCP URL.'), { statusCode: 400 }); }
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
        throw Object.assign(new Error('Chronos requires HTTPS or a local HTTP endpoint.'), { statusCode: 400 });
      }
      if (url.username || url.password || url.search || url.hash || !['codex', 'claude'].includes(value.agentId)) {
        throw Object.assign(new Error('Invalid Chronos connection settings.'), { statusCode: 400 });
      }
      if (value.enabled) {
        await this.workspaceProject(value.projectName);
        if (!value.token && !this.agentsConfig.value.chronos.token) {
          throw Object.assign(new Error('A Chronos agent token is required.'), { statusCode: 400 });
        }
      }
    }
    const currentTelegram = this.agentsConfig.value.notifications.telegram;
    await this.agentsConfig.update({
      agents: input.agents,
      models: input.models ? {
        api: this.keepModelKey('api', input.models.api),
        ollama: this.keepModelKey('ollama', input.models.ollama)
      } : undefined,
      warmup: input.warmup,
      chronos: input.chronos ? {
        ...input.chronos,
        token: input.chronos.token || (input.chronos.url === this.agentsConfig.value.chronos.url ? this.agentsConfig.value.chronos.token : '')
      } : undefined,
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

  private keepModelKey(id: 'api' | 'ollama', model: ServerSettings['models']['api']) {
    const current = this.agentsConfig.value.models[id];
    return { model: model.model, baseUrl: model.baseUrl, apiKey: model.apiKey || (model.baseUrl === current.baseUrl ? current.apiKey : '') };
  }

  private async workspaceProject(name: string) {
    if (typeof name !== 'string' || !name.trim()) throw Object.assign(new Error('Choose a workspace project.'), { statusCode: 400 });
    await this.projects.ensureProjectExists(name);
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
