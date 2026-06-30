import type { FastifyInstance } from 'fastify';
import type { AuthService } from './auth.service.js';

type LoginBody = {
  username: string;
  password: string;
};

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService) {
  app.post<{ Body: LoginBody }>(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const user = auth.login(request.body.username, request.body.password);
      auth.createSession(reply, user);
      return { user };
    }
  );

  app.post('/api/auth/logout', async (request, reply) => {
    auth.clearSession(request, reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (request) => ({ user: auth.getUser(request) }));
}
