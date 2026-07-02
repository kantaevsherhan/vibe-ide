import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { VibeIdeConfig } from '../../config/default-config.js';

export type AuthUser = {
  username: string;
  email: string;
};

const sessionCookieName = 'vibeide_session';

export class AuthService {
  private readonly sessions = new Map<string, AuthUser>();

  constructor(private readonly config: VibeIdeConfig) {}

  get cookieName() {
    return sessionCookieName;
  }

  login(username: string, password: string) {
    if (!this.config.auth.enabled) return this.configUser();

    if (username !== this.config.auth.username || password !== this.config.auth.password) {
      throw Object.assign(new Error('Invalid username or password.'), { statusCode: 401 });
    }

    return this.configUser();
  }

  createSession(reply: FastifyReply, user: AuthUser) {
    const token = crypto.randomBytes(32).toString('base64url');
    this.sessions.set(token, user);
    reply.setCookie(sessionCookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
    return token;
  }

  clearSession(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies?.[sessionCookieName] ?? this.getBearerToken(request) ?? this.getQueryToken(request);
    if (token) this.sessions.delete(token);
    reply.clearCookie(sessionCookieName, { path: '/' });
  }

  getUser(request: FastifyRequest) {
    if (!this.config.auth.enabled) return this.configUser();
    const token = request.cookies?.[sessionCookieName] ?? this.getBearerToken(request) ?? this.getQueryToken(request);
    if (!token) return null;
    return this.sessions.get(token) ?? null;
  }

  isAuthorized(request: FastifyRequest) {
    return Boolean(this.getUser(request));
  }

  private configUser(): AuthUser {
    return {
      username: this.config.auth.username,
      email: this.config.auth.email
    };
  }

  private getBearerToken(request: FastifyRequest) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return null;
    return authorization.slice('Bearer '.length).trim() || null;
  }

  private getQueryToken(request: FastifyRequest) {
    const url = new URL(request.raw.url ?? '/', 'http://localhost');
    return url.searchParams.get('authToken');
  }
}
