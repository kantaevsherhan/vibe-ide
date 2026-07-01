import type { FastifyInstance } from 'fastify';
import type { SystemService } from './system.service.js';

export async function registerSystemRoutes(app: FastifyInstance, system: SystemService) {
  app.post('/api/system/check-update', async () => system.checkUpdate());
}
