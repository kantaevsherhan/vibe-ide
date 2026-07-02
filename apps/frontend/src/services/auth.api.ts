import { apiRequest } from './api';

export type AuthUser = {
  username: string;
  email: string;
};

export type LoginResponse = {
  user: AuthUser;
  token?: string;
};

export const authApi = {
  login(username: string, password: string) {
    return apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },
  logout() {
    return apiRequest<{ ok: true }>('/api/auth/logout', {
      method: 'POST'
    });
  },
  me() {
    return apiRequest<{ user: AuthUser | null }>('/api/auth/me');
  }
};
