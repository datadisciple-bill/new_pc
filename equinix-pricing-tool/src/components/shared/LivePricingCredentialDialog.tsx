import { useState, useCallback } from 'react';
import { authenticate } from '@/api/auth';
import { ApiError } from '@/api/client';
import { clearVCPricingCache } from '@/api/vcPricingCache';

interface LivePricingCredentialDialogProps {
  onAuthenticated: () => void;
  onCancel: () => void;
}

export function LivePricingCredentialDialog({ onAuthenticated, onCancel }: LivePricingCredentialDialogProps) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      await authenticate(clientId, clientSecret, true);
      clearVCPricingCache();
      onAuthenticated();
    } catch (err) {
      let msg = 'Authentication failed';
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 400) {
          msg = 'Invalid Client ID or Client Secret. Please check your credentials and try again.';
        } else {
          msg = `API error (${err.status}): ${err.message}`;
        }
      } else if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message.includes('NetworkError'))) {
        msg = 'Unable to reach the Equinix API. The API does not allow direct browser requests (CORS). To use live pricing, run the app behind a proxy or use the "Refresh Data" option to fetch data with credentials instead.';
      } else if (err instanceof Error) {
        if (err.message === 'Failed to fetch' || err.message === 'Request failed after retries') {
          msg = 'Unable to reach the Equinix API. The API does not allow direct browser requests (CORS). To use live pricing, run the app behind a proxy or use the "Refresh Data" option to fetch data with credentials instead.';
        } else {
          msg = err.message;
        }
      }
      setError(msg);
      setStatus('error');
    }
  }, [clientId, clientSecret, onAuthenticated]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-equinix-black text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">Enable Live Pricing</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Fetch real-time VC and EIA prices from Equinix API
            </p>
          </div>
          <button onClick={onCancel} title="Close" className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Enter Equinix API credentials to fetch real-time pricing from the Equinix API.
          </p>
          <div className="bg-gray-50 rounded-md p-3 text-xs space-y-2">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Live pricing (from API):</p>
              <ul className="text-gray-600 space-y-0.5 ml-3">
                <li className="flex items-start gap-1.5"><span className="text-green-600 mt-px">&#x25CF;</span>Virtual Connections (metro-to-metro, cloud, bandwidth-specific)</li>
                <li className="flex items-start gap-1.5"><span className="text-green-600 mt-px">&#x25CF;</span>Internet Access / EIA (per-metro, bandwidth, delivery method)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Cached pricing (unchanged):</p>
              <ul className="text-gray-600 space-y-0.5 ml-3">
                <li className="flex items-start gap-1.5"><span className="text-gray-400 mt-px">&#x25CB;</span>Fabric Ports</li>
                <li className="flex items-start gap-1.5"><span className="text-gray-400 mt-px">&#x25CB;</span>Network Edge</li>
                <li className="flex items-start gap-1.5"><span className="text-gray-400 mt-px">&#x25CB;</span>Fabric Cloud Router</li>
              </ul>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-equinix-green"
              placeholder="Enter Client ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
            <input
              type="text"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-equinix-green"
              placeholder="Enter Client Secret"
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-md p-3">{error}</div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={status === 'loading' || !clientId || !clientSecret}
              title="Authenticate and enable live pricing"
              className="flex-1 bg-equinix-black text-white py-2.5 rounded-md font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Authenticating...' : 'Enable Live Pricing'}
            </button>
            <button
              onClick={onCancel}
              title="Cancel and close"
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Credentials stay in your browser's memory only — never sent to any server besides Equinix.
            They are cleared when you switch back to cached mode or close the tab.
          </p>
        </div>
      </div>
    </div>
  );
}
