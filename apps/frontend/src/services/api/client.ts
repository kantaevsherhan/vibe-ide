import { Capacitor, CapacitorHttp } from '@capacitor/core';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const customBackendEnabledKey = 'vibeide:custom-backend:enabled';
export const customBackendUrlKey = 'vibeide:custom-backend:url';
export const authTokenKey = 'vibeide:auth:token';
export const authTokenBackendKey = 'vibeide:auth:backend';

const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export function normalizeBackendUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

export function isValidBackendUrl(url: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isCustomBackendEnabled() {
  return localStorage.getItem(customBackendEnabledKey) === 'true';
}

export function getApiBaseUrl() {
  const enabled = isCustomBackendEnabled();
  const url = normalizeBackendUrl(localStorage.getItem(customBackendUrlKey) ?? '');

  if (enabled && url) {
    return url;
  }

  if (Capacitor.isNativePlatform() && !envApiBaseUrl) {
    throw new ApiError('Backend URL is required for mobile app.', 0);
  }

  return envApiBaseUrl;
}

export function getAuthBackendKey() {
  return getApiBaseUrl() || location.origin;
}

export function isCrossOriginApi() {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return false;
  return new URL(apiBaseUrl, location.origin).origin !== location.origin;
}

export function setApiAuthToken(token: string | null) {
  if (!token) {
    clearApiAuthToken();
    return;
  }

  localStorage.setItem(authTokenKey, token);
  localStorage.setItem(authTokenBackendKey, getAuthBackendKey());
}

export function clearApiAuthToken() {
  localStorage.removeItem(authTokenKey);
  localStorage.removeItem(authTokenBackendKey);
}

export function getApiAuthToken() {
  const token = localStorage.getItem(authTokenKey);
  const backend = localStorage.getItem(authTokenBackendKey);
  if (!token || backend !== getAuthBackendKey()) return null;
  return token;
}

export function getWsBaseUrl() {
  const apiUrl = getApiBaseUrl();

  if (!apiUrl) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}`;
  }

  const parsed = new URL(apiUrl);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return parsed.toString().replace(/\/+$/, '');
}

export function apiUrl(path: string) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl || /^https?:\/\//.test(path)) return path;
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function wsUrl(path: string) {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, getWsBaseUrl());
  const token = getApiAuthToken();
  if (token) url.searchParams.set('authToken', token);
  if (import.meta.env.DEV) {
    console.debug('[ws]', {
      url: url.toString().replace(/authToken=[^&]+/, 'authToken=***'),
      backendUrl: getApiBaseUrl() || 'same-origin',
      native: Capacitor.isNativePlatform(),
      authorizationToken: Boolean(token)
    });
  }
  return url.toString();
}

function parseBody(body: BodyInit | null | undefined) {
  if (typeof body !== 'string') return body ?? undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function normalizeHeaders(headers: HeadersInit | undefined) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

function hasBody(init?: RequestInit) {
  return init?.body !== undefined && init.body !== null;
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getApiAuthToken();
  const headers: Record<string, string> = {
    ...(hasBody(init) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...normalizeHeaders(init?.headers)
  };
  const method = init?.method ?? 'GET';
  const requestUrl = apiUrl(url);

  if (import.meta.env.DEV) {
    console.debug('[api]', {
      backendUrl: getApiBaseUrl() || 'same-origin',
      credentials: 'include',
      authorizationHeader: Boolean(token),
      cookiePresent: document.cookie.includes('vibeide_session='),
      native: Capacitor.isNativePlatform()
    });
  }

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      method,
      url: requestUrl,
      headers,
      data: parseBody(init?.body)
    });

    if (response.status < 200 || response.status >= 300) {
      const payload = typeof response.data === 'object' && response.data !== null ? (response.data as { error?: string; message?: string }) : null;
      throw new ApiError(payload?.message ?? payload?.error ?? `Request failed: ${response.status}`, response.status);
    }

    return response.data as T;
  }

  const response = await fetch(requestUrl, {
    headers,
    credentials: 'include',
    ...init
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiError(payload?.message ?? payload?.error ?? `Request failed: ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}
