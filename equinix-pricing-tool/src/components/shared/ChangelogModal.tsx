import { useState } from 'react';

export const CURRENT_VERSION = 11.2;
export const RELEASE_DATE = new Date('2026-03-03T00:00:00');

interface ChangelogEntry {
  version: number;
  date: string;
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: 11.2,
    date: 'Mar 3, 2026',
    items: [
      'Per-metro-pair VC pricing — DC↔LD now costs differently from DA↔LD (819 cached price points across 91 metro pairs)',
      'VC and Cross Connect fees to Equinix Internet Access are now bundled ($0) — included in the EIA service price',
      'Connecting EIA to an HA Network Edge device automatically defaults to a redundant (dual) connection',
      'Fetch script can now pull real per-pair VC pricing from the Equinix API for 13 key metros',
    ],
  },
  {
    version: 11.1,
    date: 'Mar 3, 2026',
    items: [
      'Fixed NE diagram nodes not showing memory/RAM when a device is selected',
      'NE diagram nodes now auto-size taller to fit cores, memory, and software detail',
      'Bandwidth labels no longer disappear when dragging metro containers',
      'Bundled Cross Connects inherit redundancy from Redundant Fabric Ports',
      'Multipoint network connection handles now work correctly from all four sides',
    ],
  },
  {
    version: 11,
    date: 'Mar 2, 2026',
    items: [
      'Cached/Live pricing toggle — switch to live mode to fetch real-time VC and EIA prices from the Equinix API',
      'Multipoint network support (EVP-LAN/EP-LAN) with dedicated diagram nodes, top/bottom/left/right connection handles, and management UI',
      'Clicking a multipoint network on the diagram now highlights and scrolls to it in the editing pane',
      'Multipoint network diagram nodes show region name (e.g. "Americas") instead of generic "Regional scope"',
      'Network Edge devices now display RAM/memory on the diagram node (thanks Al Zsidi)',
      'Fixed NE memory not updating when selecting cores from the price table',
      'Fixed EIA labeling on diagram nodes (thanks Al Zsidi)',
      'Fixed edge labels rendering on top of nodes instead of behind them (thanks Al Zsidi)',
      'Fixed routing display for connections on the diagram (thanks Al Zsidi)',
      'Live pricing dialog shows clear CORS error message instead of generic "Failed to fetch"',
      'Credential fields are now visible while typing',
    ],
  },
  {
    version: 10,
    date: 'Feb 26, 2026',
    items: [
      'Drag-to-connect: drag from a handle on one service node to another to create connections automatically',
      'Auto-detects connection type — Cross Connect for physical-to-physical, Virtual Circuit for fabric-to-fabric',
      'Bundled Cross Connects ($0) created automatically when connecting Colocation to Fabric Port',
      'Invalid connections show clear error messages explaining why and suggesting alternatives',
      'Handle dots glow green on hover for better drag discoverability',
    ],
  },
  {
    version: 9,
    date: 'Feb 26, 2026',
    items: [
      'View a bandwidth/price comparison table for Internet Access directly on the diagram',
      'Fabric Ports set to "Redundant" now display the red HA badge on the diagram',
      'In-app changelog — click the version number to see what\'s new',
    ],
  },
  {
    version: 8,
    date: 'Feb 26, 2026',
    items: [
      'Save and load your projects as JSON files using Export/Import buttons',
      'Internet Access now shows live pricing from the Equinix API',
      'Network Edge defaults to BYOL license and only shows available license types',
    ],
  },
  {
    version: 7,
    date: 'Feb 26, 2026',
    items: [
      'Add Local Sites to your diagram to represent customer locations with customizable icons',
      'Place numbered annotation markers anywhere on the diagram for callouts',
      'Redundant virtual connections now show as double lines',
      'New Network Service Provider (NSP) service type',
      'Two-step delete confirmation protects against accidental removal',
    ],
  },
  {
    version: 6,
    date: 'Feb 25, 2026',
    items: [
      'Pricing data can now be fetched directly from the Equinix API using your credentials',
      'The app ships with pre-built default pricing so it works without API access',
      'Credentials load from a .env file for convenience',
    ],
  },
  {
    version: 5,
    date: 'Feb 25, 2026',
    items: [
      'New Colocation service type for cage/cabinet pricing',
      'Add text boxes anywhere on the diagram for notes',
      'Export your diagram as a PNG image',
      'Snap-to-grid alignment for cleaner layouts',
      'Metro containers dynamically resize to fit their services',
    ],
  },
  {
    version: 4,
    date: 'Feb 25, 2026',
    items: [
      'Metro containers automatically size to fit all services',
      'Network Edge price tables can be displayed directly on the diagram',
      'Drag cloud labels and price tables to reposition them',
      'Undo support for configuration changes',
    ],
  },
  {
    version: 3,
    date: 'Feb 25, 2026',
    items: [
      'New 4-panel desktop layout: Metros, Services, Diagram, and Pricing side by side',
      'Custom SVG icons for all Equinix services',
    ],
  },
  {
    version: 2,
    date: 'Feb 25, 2026',
    items: [
      'Interactive network diagram with Equinix branding',
      'Real-time pricing display on service nodes',
      'Network Edge price/size comparison table',
      'Virtual Connection bandwidth and pricing support',
    ],
  },
  {
    version: 1,
    date: 'Feb 25, 2026',
    items: [
      'Initial release with metro selection, service configuration, and diagram generation',
    ],
  },
];

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([CURRENT_VERSION]));

  const toggle = (version: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="bg-equinix-black text-white px-6 py-4 rounded-t-lg flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold">What's New</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {CHANGELOG.map((entry) => {
            const isOpen = expanded.has(entry.version);
            const isCurrent = entry.version === CURRENT_VERSION;
            return (
              <div key={entry.version} className={`rounded-md border ${isCurrent ? 'border-equinix-green' : 'border-gray-200'}`}>
                <button
                  onClick={() => toggle(entry.version)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrent ? 'bg-equinix-green text-white' : 'bg-gray-100 text-gray-600'}`}>
                      v{entry.version}
                    </span>
                    <span className="text-xs text-gray-400">{entry.date}</span>
                    {isCurrent && <span className="text-[10px] text-equinix-green font-medium">Latest</span>}
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <ul className="px-4 pb-3 space-y-1.5">
                    {entry.items.map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-equinix-green mt-0.5 flex-shrink-0">&#x2022;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
