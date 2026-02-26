import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiRequest, ApiError } from './client';
import { useConfigStore } from '@/store/configStore';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200, statusText = 'OK', headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (key: string) => headers?.[key] ?? null,
    },
    json: () => Promise.resolve(data),
  };
}

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useConfigStore.setState({
      auth: { token: 'test-token', tokenExpiry: Date.now() + 3600000, isAuthenticated: true, userName: 'user' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes a GET request with auth header', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'ok' }));

    const result = await apiRequest('/test/path');

    expect(result).toEqual({ data: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.equinix.com/test/path',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('makes a POST request with body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));

    await apiRequest('/test', { method: 'POST', body: { key: 'value' } });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.equinix.com/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      })
    );
  });

  it('skips auth header when skipAuth is true', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiRequest('/public', { skipAuth: true });

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('throws ApiError on 401 and clears auth', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401, 'Unauthorized'));

    await expect(apiRequest('/secure')).rejects.toThrow('Authentication expired');

    const auth = useConfigStore.getState().auth;
    expect(auth.isAuthenticated).toBe(false);
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 500, 'Internal Server Error'));

    await expect(apiRequest('/fail')).rejects.toThrow('API error: Internal Server Error');
  });

  it('retries on 429 with exponential backoff', async () => {
    vi.useFakeTimers();

    // First call: 429, second call: success
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 429, 'Too Many Requests'))
      .mockResolvedValueOnce(jsonResponse({ retried: true }));

    const promise = apiRequest('/rate-limited');
    // Advance timers to allow the backoff sleep to resolve
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toEqual({ retried: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('uses Retry-After header when present on 429', async () => {
    vi.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 429, 'Too Many Requests', { 'Retry-After': '3' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const promise = apiRequest('/rate-limited');
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toEqual({ ok: true });

    vi.useRealTimers();
  });

  it('throws when not authenticated and skipAuth is false', async () => {
    useConfigStore.setState({
      auth: { token: null, tokenExpiry: null, isAuthenticated: false, userName: null },
    });

    await expect(apiRequest('/secure')).rejects.toThrow('Not authenticated');
  });

  it('retries on network errors', async () => {
    vi.useFakeTimers();

    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(jsonResponse({ recovered: true }));

    const promise = apiRequest('/flaky');
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toEqual({ recovered: true });

    vi.useRealTimers();
  });

  it('throws after exhausting retries', async () => {
    // Make sleep resolve instantly so retries exhaust quickly without fake timer issues
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void) => origSetTimeout(fn, 0)) as typeof globalThis.setTimeout;

    try {
      mockFetch.mockImplementation(() => Promise.reject(new Error('Network down')));

      await expect(apiRequest('/down')).rejects.toThrow('Network down');
      // 5 attempts total (initial + 4 retries)
      expect(mockFetch).toHaveBeenCalledTimes(5);
    } finally {
      globalThis.setTimeout = origSetTimeout;
    }
  });
});

describe('ApiError', () => {
  it('has correct properties', () => {
    const err = new ApiError(404, 'Not Found', { detail: 'missing' });
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not Found');
    expect(err.body).toEqual({ detail: 'missing' });
    expect(err.name).toBe('ApiError');
  });
});
