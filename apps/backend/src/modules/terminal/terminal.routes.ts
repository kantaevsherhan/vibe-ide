import type { FastifyInstance } from 'fastify';
import type { TerminalMessage } from '../../types/terminal.js';
import type { AuthService } from '../auth/auth.service.js';
import type { TerminalService } from './terminal.service.js';

export async function registerTerminalRoutes(app: FastifyInstance, terminals: TerminalService, auth: AuthService) {
  app.get('/api/terminal/sessions', async () => ({ sessions: terminals.list() }));

  app.get('/ws/terminal', { websocket: true }, (socket, request) => {
    if (!auth.isAuthorized(request)) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    const send = (message: unknown) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    terminals.attach(send);

    socket.on('message', (raw: Buffer | ArrayBuffer | string) => {
      try {
        const message = JSON.parse(raw.toString()) as TerminalMessage;
        terminals.handle(message, send);
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
