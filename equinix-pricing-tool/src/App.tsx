import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useConfigStore } from '@/store/configStore';
import { MetroSelector } from '@/components/metro/MetroSelector';
import { ServiceSelector } from '@/components/services/ServiceSelector';
import { VirtualConnectionConfig } from '@/components/services/VirtualConnectionConfig';
import { NetworkDiagram } from '@/components/diagram/NetworkDiagram';
import { PriceSheet } from '@/components/pricing/PriceSheet';
import { CsvExport } from '@/components/export/CsvExport';
import { DataEditor } from '@/components/admin/DataEditor';
import { loadCachedOptions, saveCachedOptions, isCacheValid, formatCacheAge, type CachedOptions } from '@/api/cache';
import { fetchMetros } from '@/api/fabric';
import { fetchDeviceTypes } from '@/api/networkEdge';
import { fetchServiceProfiles } from '@/api/fabric';
import { authenticate } from '@/api/auth';
import { setDefaultPricing, setDefaultLocations, hasDefaultPricing } from '@/data/defaultPricing';

// Hash-based routing for unlisted pages
function useHash(): string {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); },
    () => window.location.hash,
  );
}

type Tab = 'metros' | 'services' | 'diagram' | 'pricing';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'metros', label: 'Metros', icon: 'M4 6h16M4 12h16m-7 6h7' },
  { id: 'services', label: 'Services', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { id: 'diagram', label: 'Diagram', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { id: 'pricing', label: 'Pricing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

function App() {
  const hash = useHash();
  const activeTab = useConfigStore((s) => s.ui.activeTab);
  const setActiveTab = useConfigStore((s) => s.setActiveTab);
  const selectedMetros = useConfigStore((s) => s.project.metros);
  const selectedMetroCode = useConfigStore((s) => s.ui.selectedMetroCode);
  const setSelectedMetro = useConfigStore((s) => s.setSelectedMetro);
  const projectName = useConfigStore((s) => s.project.name);
  const setProjectName = useConfigStore((s) => s.setProjectName);

  const [dataReady, setDataReady] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CachedOptions | null>(null);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);

  // Load data on startup: defaults.json (API-fetched) > IndexedDB cache > mock data
  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let staticDefaults: any = null;

      // Try to load the API-fetched defaults.json (produced by npm run fetch-data)
      try {
        const res = await fetch('/data/defaults.json');
        if (res.ok) {
          staticDefaults = await res.json();
          if (staticDefaults?.pricing) {
            setDefaultPricing(staticDefaults.pricing);
          }
          if (staticDefaults?.eiaLocations) {
            setDefaultLocations(staticDefaults.eiaLocations, staticDefaults.referenceIbx);
          }
        }
      } catch {
        // Static defaults not available — not an error
      }

      // Priority 1: defaults.json has metros/deviceTypes/etc from the real API
      if (staticDefaults?.metros?.length) {
        useConfigStore.getState().setMetros(staticDefaults.metros);
        // Normalize availableMetros — API may return objects instead of strings
        const normalizedDeviceTypes = (staticDefaults.deviceTypes ?? []).map((dt: Record<string, unknown>) => ({
          ...dt,
          availableMetros: (Array.isArray(dt.availableMetros) ? dt.availableMetros : []).map(
            (m: string | { code: string }) => typeof m === 'string' ? m : m.code
          ).filter(Boolean),
        }));
        useConfigStore.getState().setDeviceTypes(normalizedDeviceTypes);
        useConfigStore.getState().setServiceProfiles(staticDefaults.serviceProfiles ?? []);
        setCacheInfo({
          cachedAt: new Date(staticDefaults.fetchedAt).getTime(),
          metros: staticDefaults.metros,
          deviceTypes: staticDefaults.deviceTypes ?? [],
          serviceProfiles: staticDefaults.serviceProfiles ?? [],
          routerPackages: staticDefaults.routerPackages ?? [],
          eiaLocations: staticDefaults.eiaLocations ?? [],
        });
      } else {
        // Priority 2: IndexedDB cache (from in-app "Refresh Data" dialog)
        const cached = await loadCachedOptions();
        if (cached && isCacheValid(cached)) {
          useConfigStore.getState().setMetros(cached.metros);
          useConfigStore.getState().setDeviceTypes(cached.deviceTypes);
          useConfigStore.getState().setServiceProfiles(cached.serviceProfiles);
          setCacheInfo(cached);
        } else {
          // Priority 3: Mock data fallback (works without auth or defaults.json)
          await fetchMetros();
          await fetchDeviceTypes();
          await fetchServiceProfiles();
          if (cached) setCacheInfo(cached);
        }
      }
      setDataReady(true);
    })();
  }, []);

  if (!dataReady) {
    return (
      <div className="h-dvh flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-equinix-green rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading options...</p>
        </div>
      </div>
    );
  }

  // Unlisted admin page at #/admin
  if (hash === '#/admin') {
    return <DataEditor />;
  }

  return (
    <div className="h-dvh flex flex-col bg-white">
      {/* Top header bar */}
      <header className="bg-equinix-black text-white flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold">Equinix</h1>
          <span className="text-[10px] text-gray-500">v6</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-b border-gray-600 text-sm text-white px-1 py-0.5 focus:outline-none focus:border-equinix-green w-40 sm:w-60"
          />
        </div>
        <div className="flex items-center gap-3">
          <CsvExport />
          <button
            onClick={() => setShowRefreshDialog(true)}
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            title={cacheInfo ? `Data cached ${formatCacheAge(cacheInfo)}` : 'Using default data'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {hasDefaultPricing() ? (
              <span>{cacheInfo ? formatCacheAge(cacheInfo) : 'API data'}</span>
            ) : (
              <span className="text-yellow-400">Mock data</span>
            )}
          </button>
        </div>
      </header>

      {/* Refresh Data Dialog */}
      {showRefreshDialog && (
        <RefreshDataDialog
          cacheInfo={cacheInfo}
          onClose={() => setShowRefreshDialog(false)}
          onRefreshed={(newCache) => {
            setCacheInfo(newCache);
            setShowRefreshDialog(false);
          }}
        />
      )}

      {/* Desktop layout: 4-panel */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Panel 1: Metro list (narrow) */}
        <div className="w-[240px] border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <MetroSelector compact />
        </div>

        {/* Panel 2: Service config for selected metro */}
        <div className="w-[360px] border-r border-gray-200 overflow-y-auto flex-shrink-0">
          {selectedMetros.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">Select a metro to configure services</p>
            </div>
          ) : (
            <>
              {/* Metro tabs */}
              <div className="flex gap-1 px-3 py-3 overflow-x-auto border-b border-gray-200 bg-gray-50">
                {selectedMetros.map((m) => (
                  <button
                    key={m.metroCode}
                    onClick={() => setSelectedMetro(m.metroCode)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                      selectedMetroCode === m.metroCode
                        ? 'bg-equinix-black text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {m.metroCode}
                  </button>
                ))}
              </div>
              {selectedMetroCode && (
                <ServiceSelector metroCode={selectedMetroCode} />
              )}
              <div className="border-t border-gray-200 pt-3">
                <VirtualConnectionConfig />
              </div>
            </>
          )}
        </div>

        {/* Panel 3: Diagram */}
        <div className="flex-1 overflow-hidden">
          <NetworkDiagram />
        </div>

        {/* Panel 4: Pricing */}
        <div className="w-[380px] border-l border-gray-200 overflow-y-auto flex-shrink-0">
          <PriceSheet />
        </div>
      </div>

      {/* Mobile layout: tab-based */}
      <div className="flex-1 overflow-hidden lg:hidden">
        <div className="h-full overflow-y-auto">
          {activeTab === 'metros' && <MetroSelector />}
          {activeTab === 'services' && (
            <div>
              {selectedMetros.length === 0 ? (
                <p className="text-center text-gray-400 text-sm p-8">Select metros first</p>
              ) : (
                <>
                  <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
                    {selectedMetros.map((m) => (
                      <button
                        key={m.metroCode}
                        onClick={() => setSelectedMetro(m.metroCode)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                          selectedMetroCode === m.metroCode
                            ? 'bg-equinix-black text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {m.metroCode}
                      </button>
                    ))}
                  </div>
                  {selectedMetroCode && (
                    <ServiceSelector metroCode={selectedMetroCode} />
                  )}
                  <div className="border-t border-gray-200 pt-3">
                    <VirtualConnectionConfig />
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === 'diagram' && (
            <div className="h-full">
              <NetworkDiagram />
            </div>
          )}
          {activeTab === 'pricing' && <PriceSheet />}
        </div>
      </div>

      {/* Bottom navigation — mobile only */}
      <nav className="lg:hidden flex-shrink-0 border-t border-gray-200 bg-white">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-equinix-green'
                  : 'text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Dialog for refreshing data from the Equinix API */
function RefreshDataDialog({
  cacheInfo,
  onClose,
  onRefreshed,
}: {
  cacheInfo: CachedOptions | null;
  onClose: () => void;
  onRefreshed: (cache: CachedOptions) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleRefresh = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      // Authenticate
      await authenticate(clientId, clientSecret);

      // Fetch all options from API
      const [metros, deviceTypes, serviceProfiles] = await Promise.all([
        fetchMetros(),
        fetchDeviceTypes(),
        fetchServiceProfiles(),
      ]);

      // Save to IndexedDB
      const newCache: CachedOptions = {
        cachedAt: Date.now(),
        metros,
        deviceTypes,
        serviceProfiles,
        routerPackages: [],
        eiaLocations: [],
      };
      await saveCachedOptions(newCache);
      onRefreshed(newCache);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
      setStatus('error');
    }
  }, [clientId, clientSecret, onRefreshed]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-equinix-black text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">Refresh Options Data</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {cacheInfo
                ? `Last updated ${formatCacheAge(cacheInfo)}`
                : 'Using default data (no API data cached)'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Enter Equinix API credentials to fetch the latest metro locations,
            device types, and service profiles. Data is cached locally for 24 hours.
          </p>
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
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-equinix-green"
              placeholder="Enter Client Secret"
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-md p-3">{error}</div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={status === 'loading' || !clientId || !clientSecret}
              className="flex-1 bg-equinix-black text-white py-2.5 rounded-md font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Fetching...' : 'Refresh Data'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Credentials are used once and not stored. Cached data persists in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
