import { useState, useCallback } from 'react';
import { useConfigStore } from '@/store/configStore';
import { authenticate, logout } from '@/api/auth';

export function useAuth() {
  const { isAuthenticated, userName } = useConfigStore((s) => s.auth);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (clientId: string, clientSecret: string) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await authenticate(clientId, clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    logout();
  }, []);

  return { isAuthenticated, userName, isLoggingIn, error, login, logout: handleLogout };
}
