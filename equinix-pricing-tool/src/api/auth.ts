import { apiRequest } from './client';
import { useConfigStore } from '@/store/configStore';
import type { AuthTokenResponse } from '@/types/equinix';
import { useMockData } from './mock/useMock';
import { mockAuth } from './mock/authMock';

const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000; // Refresh 10 min before expiry
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export async function authenticate(
  clientId: string,
  clientSecret: string
): Promise<void> {
  if (useMockData()) {
    const mockResponse = mockAuth(clientId, clientSecret);
    const expiry = Date.now() + mockResponse.token_timeout * 1000;
    useConfigStore.getState().setAuth(mockResponse.access_token, expiry, mockResponse.user_name);
    scheduleRefresh(expiry);
    return;
  }

  const response = await apiRequest<AuthTokenResponse>('/oauth2/v1/token', {
    method: 'POST',
    body: {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    },
    skipAuth: true,
  });

  const expiry = Date.now() + response.token_timeout * 1000;
  useConfigStore.getState().setAuth(response.access_token, expiry, response.user_name);
  scheduleRefresh(expiry);
}

function scheduleRefresh(expiry: number): void {
  if (refreshTimer) clearTimeout(refreshTimer);

  const refreshAt = expiry - TOKEN_REFRESH_BUFFER_MS;
  const delay = Math.max(refreshAt - Date.now(), 0);

  refreshTimer = setTimeout(async () => {
    try {
      const response = await apiRequest<AuthTokenResponse>(
        '/oauth2/v1/refreshaccesstoken',
        { method: 'POST' }
      );
      const newExpiry = Date.now() + response.token_timeout * 1000;
      useConfigStore.getState().setAuth(response.access_token, newExpiry, response.user_name);
      scheduleRefresh(newExpiry);
    } catch {
      useConfigStore.getState().clearAuth();
    }
  }, delay);
}

export function logout(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  useConfigStore.getState().clearAuth();
}
