import type { FastifyInstance } from 'fastify';
import type { FilesService } from './files.service.js';

type PathQuery = { path?: string };
type ProjectPathQuery = { projectName: string; path?: string; force?: string };
type WriteBody = { projectName: string; path: string; content: string };
type CreateBody = { projectName: string; path: string; content?: string };

export async function registerFilesRoutes(app: FastifyInstance, files: FilesService) {
  app.get<{ Querystring: { projectName: string } }>('/api/files/tree', async (request) => ({
    tree: await files.tree(request.query.projectName)
  }));

  app.get<{ Querystring: { projectName: string; path?: string; force?: string } }>('/api/files/children', async (request) =>
    files.children(request.query.projectName, request.query.path ?? '', request.query.force === 'true')
  );

  app.get<{ Querystring: ProjectPathQuery }>('/api/files/read', async (request) => {
    const content = await files.read(request.query.projectName, request.query.path ?? '', request.query.force === 'true');
    return { content };
  });

  app.post<{ Body: WriteBody }>('/api/files/write', async (request) => {
    await files.write(request.body.projectName, request.body.path, request.body.content ?? '');
    return { ok: true };
  });

  app.post<{ Body: CreateBody }>('/api/files/create-file', async (request) => {
    await files.createFile(request.body.projectName, request.body.path, request.body.content ?? '');
    return { ok: true };
  });

  app.post<{ Body: CreateBody }>('/api/files/create-folder', async (request) => {
    await files.createFolder(request.body.projectName, request.body.path);
    return { ok: true };
  });

  app.delete<{ Querystring: ProjectPathQuery }>('/api/files/delete', async (request) => {
    await files.delete(request.query.projectName, request.query.path ?? '');
    return { ok: true };
  });
}
