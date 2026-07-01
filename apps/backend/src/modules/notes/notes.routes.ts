import type { FastifyInstance } from 'fastify';
import type { NotesService } from './notes.service.js';

type ProjectPathQuery = { projectName: string; path?: string };
type SearchQuery = { projectName: string; query?: string };
type NoteBody = { projectName: string; path: string; content?: string };
type RenameBody = { projectName: string; from: string; to: string };

export async function registerNotesRoutes(app: FastifyInstance, notes: NotesService) {
  app.get<{ Querystring: ProjectPathQuery }>('/api/notes/tree', async (request) => notes.children(request.query.projectName, request.query.path ?? ''));

  app.get<{ Querystring: ProjectPathQuery }>('/api/notes/file', async (request) => ({
    content: await notes.read(request.query.projectName, request.query.path ?? '')
  }));

  app.post<{ Body: NoteBody }>('/api/notes/file', async (request) => {
    await notes.createFile(request.body.projectName, request.body.path, request.body.content ?? '');
    return { ok: true };
  });

  app.put<{ Body: NoteBody }>('/api/notes/file', async (request) => {
    await notes.write(request.body.projectName, request.body.path, request.body.content ?? '');
    return { ok: true };
  });

  app.delete<{ Querystring: ProjectPathQuery }>('/api/notes/file', async (request) => {
    await notes.delete(request.query.projectName, request.query.path ?? '');
    return { ok: true };
  });

  app.post<{ Body: NoteBody }>('/api/notes/folder', async (request) => {
    await notes.createFolder(request.body.projectName, request.body.path);
    return { ok: true };
  });

  app.put<{ Body: RenameBody }>('/api/notes/rename', async (request) => {
    await notes.rename(request.body.projectName, request.body.from, request.body.to);
    return { ok: true };
  });

  app.post<{ Body: RenameBody }>('/api/notes/duplicate', async (request) => {
    await notes.duplicate(request.body.projectName, request.body.from, request.body.to);
    return { ok: true };
  });

  app.get<{ Querystring: SearchQuery }>('/api/notes/search', async (request) => ({
    results: await notes.search(request.query.projectName, request.query.query ?? '')
  }));
}
