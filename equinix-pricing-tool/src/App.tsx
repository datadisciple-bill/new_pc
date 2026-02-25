import { useAuth } from '@/hooks/useAuth';
import { useConfigStore } from '@/store/configStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { MetroSelector } from '@/components/metro/MetroSelector';
import { ServiceSelector } from '@/components/services/ServiceSelector';
import { VirtualConnectionConfig } from '@/components/services/VirtualConnectionConfig';
import { NetworkDiagram } from '@/components/diagram/NetworkDiagram';
import { PriceSheet } from '@/components/pricing/PriceSheet';
import { CsvExport } from '@/components/export/CsvExport';

type Tab = 'metros' | 'services' | 'diagram' | 'pricing';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'metros', label: 'Metros', icon: 'M4 6h16M4 12h16m-7 6h7' },
  { id: 'services', label: 'Services', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { id: 'diagram', label: 'Diagram', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { id: 'pricing', label: 'Pricing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

function App() {
  const { isAuthenticated, userName, logout } = useAuth();
  const activeTab = useConfigStore((s) => s.ui.activeTab);
  const setActiveTab = useConfigStore((s) => s.setActiveTab);
  const selectedMetros = useConfigStore((s) => s.project.metros);
  const selectedMetroCode = useConfigStore((s) => s.ui.selectedMetroCode);
  const setSelectedMetro = useConfigStore((s) => s.setSelectedMetro);
  const projectName = useConfigStore((s) => s.project.name);
  const setProjectName = useConfigStore((s) => s.setProjectName);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="h-dvh flex flex-col bg-white">
      {/* Top header bar */}
      <header className="bg-equinix-black text-white flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold">Equinix</h1>
          <span className="text-[10px] text-gray-500">v2</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-b border-gray-600 text-sm text-white px-1 py-0.5 focus:outline-none focus:border-equinix-green w-40 sm:w-60"
          />
        </div>
        <div className="flex items-center gap-3">
          <CsvExport />
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
            <span>{userName}</span>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Desktop layout: 3-panel */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Left: config */}
        <div className="w-[380px] border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <MetroSelector />
          {selectedMetros.length > 0 && (
            <div className="border-t border-gray-200">
              {/* Metro tabs for services */}
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
            </div>
          )}
        </div>

        {/* Center: diagram */}
        <div className="flex-1 overflow-hidden">
          <NetworkDiagram />
        </div>

        {/* Right: pricing */}
        <div className="w-[400px] border-l border-gray-200 overflow-y-auto flex-shrink-0">
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

export default App;
