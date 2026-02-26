import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useConfigStore } from '@/store/configStore';

// Mock useMock to control mock data mode
vi.mock('./mock/useMock', () => ({
  useMockData: vi.fn(() => true),
}));

// Mock apiRequest so we don't hit real network
vi.mock('./client', () => ({
  apiRequest: vi.fn(),
}));

import { authenticate, logout } from './auth';
import { useMockData } from './mock/useMock';
import { apiRequest } from './client';

describe('auth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConfigStore.setState({
      auth: { token: null, tokenExpiry: null, isAuthenticated: false, userName: null },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('authenticate (mock mode)', () => {
    it('sets auth state with mock data', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      await authenticate('client-id', 'client-secret');

      const auth = useConfigStore.getState().auth;
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.token).toBeTruthy();
      expect(auth.userName).toBeTruthy();
    });
  });

  describe('authenticate (live mode)', () => {
    it('calls apiRequest and sets auth state', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      vi.mocked(apiRequest).mockResolvedValueOnce({
        access_token: 'live-token-123',
        token_type: 'Bearer',
        token_timeout: 3600,
        user_name: 'live@equinix.com',
      });

      await authenticate('real-id', 'real-secret');

      expect(apiRequest).toHaveBeenCalledWith('/oauth2/v1/token', {
        method: 'POST',
        body: {
          grant_type: 'client_credentials',
          client_id: 'real-id',
          client_secret: 'real-secret',
        },
        skipAuth: true,
      });

      const auth = useConfigStore.getState().auth;
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.token).toBe('live-token-123');
      expect(auth.userName).toBe('live@equinix.com');
    });
  });

  describe('logout', () => {
    it('clears auth state', async () => {
      vi.mocked(useMockData).mockReturnValue(true);
      await authenticate('id', 'secret');
      expect(useConfigStore.getState().auth.isAuthenticated).toBe(true);

      logout();
      expect(useConfigStore.getState().auth.isAuthenticated).toBe(false);
      expect(useConfigStore.getState().auth.token).toBeNull();
    });
  });
});
