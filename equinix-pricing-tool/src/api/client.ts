import { useConfigStore } from '@/store/configStore';

const API_BASE = 'https://api.equinix.com';
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 2000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthHeader(): Record<string, string> {
  const token = useConfigStore.getState().auth.token;
  if (!token) {
    throw new ApiError(401, 'Not authenticated');
  }
  return { Authorization: `Bearer ${token}` };
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
    ...(skipAuth ? {} : getAuthHeader()),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401) {
        useConfigStore.getState().clearAuth();
        throw new ApiError(401, 'Authentication expired. Please log in again.');
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BACKOFF_BASE_MS * Math.pow(2, attempt);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new ApiError(response.status, `API error: ${response.statusText}`, errorBody);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError && error.status !== 429) {
        throw error;
      }
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

export { ApiError };
