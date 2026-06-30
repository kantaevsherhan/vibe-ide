import type { FastifyInstance } from 'fastify';
import type { ProjectsService } from './projects.service.js';
import type { CreateProjectInput } from './projects.types.js';

export async function registerProjectsRoutes(app: FastifyInstance, projects: ProjectsService) {
  app.get('/api/projects', async () => ({ projects: await projects.list() }));

  app.post<{ Body: CreateProjectInput }>('/api/projects', async (request, reply) => {
    const project = await projects.create(request.body);
    return reply.code(201).send({ project });
  });

  app.get<{ Params: { projectName: string } }>('/api/projects/:projectName', async (request) => ({
    project: await projects.get(request.params.projectName)
  }));

  app.delete<{ Params: { projectName: string } }>('/api/projects/:projectName', async (request) => {
    await projects.delete(request.params.projectName);
    return { ok: true };
  });
}
