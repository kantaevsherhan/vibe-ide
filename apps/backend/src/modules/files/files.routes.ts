import type { FastifyInstance } from 'fastify';
import type { FilesService } from './files.service.js';

type PathQuery = { path?: string };
type WriteBody = { path: string; content: string };
type CreateBody = { path: string; content?: string };

export async function registerFilesRoutes(app: FastifyInstance, files: FilesService) {
  app.get('/api/files/tree', async () => ({ tree: await files.tree() }));

  app.get<{ Querystring: PathQuery }>('/api/files/read', async (request) => {
    const content = await files.read(request.query.path ?? '');
    return { content };
  });

  app.post<{ Body: WriteBody }>('/api/files/write', async (request) => {
    await files.write(request.body.path, request.body.content ?? '');
    return { ok: true };
  });

  app.post<{ Body: CreateBody }>('/api/files/create-file', async (request) => {
    await files.createFile(request.body.path, request.body.content ?? '');
    return { ok: true };
  });

  app.post<{ Body: CreateBody }>('/api/files/create-folder', async (request) => {
    await files.createFolder(request.body.path);
    return { ok: true };
  });

  app.delete<{ Querystring: PathQuery }>('/api/files/delete', async (request) => {
    await files.delete(request.query.path ?? '');
    return { ok: true };
  });
}
