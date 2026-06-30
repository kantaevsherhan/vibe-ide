import type { FastifyInstance } from 'fastify';
import type { GitService } from './git.service.js';

export async function registerGitRoutes(app: FastifyInstance, git: GitService) {
  app.get<{ Querystring: { projectName: string } }>('/api/git/status', async (request) =>
    git.status(request.query.projectName)
  );
  app.get<{ Querystring: { projectName: string; path?: string } }>('/api/git/diff', async (request) => ({
    diff: await git.diff(request.query.projectName, request.query.path)
  }));
  app.get<{ Querystring: { projectName: string } }>('/api/git/diff-name-only', async (request) => ({
    files: await git.diffNameOnly(request.query.projectName)
  }));
  app.get<{ Querystring: { projectName: string } }>('/api/git/log', async (request) => ({
    log: await git.log(request.query.projectName)
  }));
}
