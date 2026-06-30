import type { FastifyInstance } from 'fastify';
import type { GitService } from './git.service.js';

export async function registerGitRoutes(app: FastifyInstance, git: GitService) {
  app.get('/api/git/status', async () => ({ files: await git.status() }));
  app.get<{ Querystring: { path?: string } }>('/api/git/diff', async (request) => ({
    diff: await git.diff(request.query.path)
  }));
  app.get('/api/git/diff-name-only', async () => ({ files: await git.diffNameOnly() }));
  app.get('/api/git/log', async () => ({ log: await git.log() }));
}
