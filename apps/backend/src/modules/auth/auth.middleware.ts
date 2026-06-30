import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './auth.service.js';

export function createRequireAuth(auth: AuthService) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    if (auth.isAuthorized(request)) return;
    return reply.code(401).send({ error: 'Unauthorized' });
  };
}
