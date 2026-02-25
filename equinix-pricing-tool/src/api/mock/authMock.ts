import type { AuthTokenResponse } from '@/types/equinix';

export function mockAuth(clientId: string, _clientSecret: string): AuthTokenResponse {
  if (!clientId) throw new Error('Client ID required');
  return {
    access_token: 'mock-token-' + Date.now(),
    token_type: 'Bearer',
    token_timeout: 3600,
    user_name: 'demo@equinix.com',
  };
}
