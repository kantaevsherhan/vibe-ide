import type { FastifyInstance } from 'fastify';
import type { HealthService } from './health.service.js';

export async function registerHealthRoutes(app: FastifyInstance, health: HealthService) {
  app.get<{ Querystring: { projectName: string } }>('/api/workspace/health', async (request) =>
    health.workspace(request.query.projectName)
  );
}
