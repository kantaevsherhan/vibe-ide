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

export function getApiBaseUrl() {
  const enabled = localStorage.getItem(customBackendEnabledKey) === 'true';
  const url = normalizeBackendUrl(localStorage.getItem(customBackendUrlKey) ?? '');

  if (enabled && url) {
    return url;
  }

  return envApiBaseUrl;
}

export function getWsBaseUrl() {
  const apiUrl = getApiBaseUrl();

  if (!apiUrl) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}`;
  }

  return apiUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

export function apiUrl(path: string) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl || /^https?:\/\//.test(path)) return path;
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function wsUrl(path: string) {
  return `${getWsBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...init?.headers
  };

  const response = await fetch(apiUrl(url), {
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
