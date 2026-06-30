import type { FastifyInstance } from 'fastify';
import type { TerminalMessage } from '../../types/terminal.js';
import type { AuthService } from '../auth/auth.service.js';
import type { TerminalService } from './terminal.service.js';

export async function registerTerminalRoutes(app: FastifyInstance, terminals: TerminalService, auth: AuthService) {
  app.get<{ Querystring: { projectName: string } }>('/api/terminal/sessions', async (request) => ({
    sessions: terminals.list(request.query.projectName)
  }));

  app.get<{ Querystring: { projectName: string } }>('/api/terminals', async (request) =>
    terminals.listApi(request.query.projectName)
  );

  app.get('/ws/terminal', { websocket: true }, (socket, request) => {
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
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    terminals.attach(projectName, send);

    socket.on('message', (raw: Buffer | ArrayBuffer | string) => {
      try {
        const message = JSON.parse(raw.toString()) as TerminalMessage;
        void terminals.handle(message, send);
      } catch (error) {
        send({
          type: 'error',
          terminalId: 'unknown',
          message: error instanceof Error ? error.message : 'Invalid terminal message.'
        });
      }
    });

    socket.on('close', () => {
      terminals.detach(send);
    });
  });
}
