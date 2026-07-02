import type { FastifyInstance } from 'fastify';
import type { SystemService } from './system.service.js';
import type { StartUpdateInput } from './update.types.js';

export async function registerSystemRoutes(app: FastifyInstance, system: SystemService) {
  app.get('/api/system/runtime', async () => system.runtime.getRuntime());
  app.post('/api/system/check-update', async () => system.updates.start());
  app.post<{ Body: StartUpdateInput }>('/api/system/update', async (request) => system.updates.start(request.body ?? {}));
  app.post<{ Body: StartUpdateInput }>('/api/system/update/start', async (request) => system.updates.start(request.body ?? {}));
  app.get<{ Params: { jobId: string } }>('/api/system/update/status/:jobId', async (request) => (
    system.updates.status(request.params.jobId)
  ));
  app.get<{ Params: { jobId: string } }>('/api/system/update/logs/:jobId', async (request) => (
    system.updates.readLogs(request.params.jobId)
  ));
}
