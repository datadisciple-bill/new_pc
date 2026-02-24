import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function LoginForm() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const { login, isLoggingIn, error } = useAuth();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login(clientId, clientSecret);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        {/* Equinix header bar */}
        <div className="bg-equinix-black text-white px-6 py-4 rounded-t-lg">
          <h1 className="text-xl font-bold">Equinix</h1>
          <p className="text-sm text-gray-300">Pricing Document Generator</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-b-lg p-6 space-y-4 shadow-sm"
        >
          <p className="text-sm text-gray-600">
            Enter your Equinix API credentials to get started.
            Credentials are stored in memory only.
          </p>

          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              id="clientId"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-equinix-green focus:border-transparent"
              placeholder="Enter your Client ID"
            />
          </div>

          <div>
            <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
            </label>
            <input
              id="clientSecret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-equinix-green focus:border-transparent"
              placeholder="Enter your Client Secret"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-md p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || !clientId || !clientSecret}
            className="w-full bg-equinix-black text-white py-2.5 rounded-md font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoggingIn ? 'Authenticating...' : 'Sign In'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Uses mock data in development mode. Set VITE_USE_MOCK=false for live API.
          </p>
        </form>
      </div>
    </div>
  );
}
