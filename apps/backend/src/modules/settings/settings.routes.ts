import type { FastifyInstance } from 'fastify';
import type { SettingsService } from './settings.service.js';
import type { TestTelegramInput, UpdateSettingsInput } from './settings.types.js';

export async function registerSettingsRoutes(app: FastifyInstance, settings: SettingsService) {
  app.get('/api/settings', async () => ({ settings: settings.get() }));

  app.put<{ Body: UpdateSettingsInput }>('/api/settings', async (request) => ({
    settings: await settings.update(request.body ?? {})
  }));

  app.post<{ Body: TestTelegramInput }>('/api/settings/test-telegram', async (request) => (
    settings.testTelegram(request.body ?? {})
  ));
}
