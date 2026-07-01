import type { FastifyInstance } from 'fastify';
import type { SystemService } from './system.service.js';

export async function registerSystemRoutes(app: FastifyInstance, system: SystemService) {
  app.post('/api/system/check-update', async () => system.updates.start());
  app.post('/api/system/update/start', async () => system.updates.start());
  app.get<{ Params: { jobId: string } }>('/api/system/update/status/:jobId', async (request) => (
    system.updates.status(request.params.jobId)
  ));
  app.get<{ Params: { jobId: string } }>('/api/system/update/logs/:jobId', async (request) => (
    system.updates.readLogs(request.params.jobId)
  ));
}
