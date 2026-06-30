import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/auth.service.js';
import type { AgentsManager } from './agents.manager.js';
import type { AgentsService } from './agents.service.js';

export async function registerAgentsRoutes(app: FastifyInstance, agents: AgentsService, manager: AgentsManager, auth: AuthService) {
  app.get('/api/agents', async () => agents.listAgents());
  app.get<{ Querystring: { projectName: string } }>('/api/agents/status', async (request) => agents.status(request.query.projectName));
  app.get<{ Querystring: { projectName: string } }>('/api/agents/tasks', async (request) => agents.tasks(request.query.projectName));
  app.post<{ Body: { projectName: string; agentId: string; prompt: string } }>('/api/agents/tasks', async (request, reply) => {
    const task = await agents.createTask(request.body);
    return reply.code(201).send(task);
  });
  app.post<{ Params: { taskId: string } }>('/api/agents/tasks/:taskId/cancel', async (request) => agents.cancelTask(request.params.taskId));
  app.post<{ Params: { taskId: string } }>('/api/agents/tasks/:taskId/retry', async (request) => agents.retryTask(request.params.taskId));
  app.post<{ Params: { taskId: string }; Body: { direction: 'up' | 'down' } }>('/api/agents/tasks/:taskId/move', async (request) =>
    agents.moveTask(request.params.taskId, request.body.direction)
  );
  app.get<{ Params: { taskId: string } }>('/api/agents/tasks/:taskId/log', async (request) => agents.taskLog(request.params.taskId));

  app.get('/ws/agents', { websocket: true }, (socket, request) => {
    if (!auth.isAuthorized(request)) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    const url = new URL(request.url, 'http://localhost');
    const projectName = url.searchParams.get('projectName');
    if (!projectName) {
      socket.close(1008, 'Project is required');
      return;
    }

    const send = (message: unknown) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };

    manager.attach(projectName, send);
    void agents.snapshot(projectName).then((snapshot) => send({ type: 'snapshot', ...snapshot }));
    socket.on('close', () => manager.detach(send));
  });
}
