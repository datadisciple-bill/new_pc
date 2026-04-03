import { useEnvironmentImport } from '@/hooks/useEnvironmentImport';
import type { ImportPhase, MetroProgress } from '@/hooks/useEnvironmentImport';
import type { EnvironmentInventoryMetro } from '@/types/config';
import { useEffect } from 'react';

interface EnvironmentImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const REGION_COLORS: Record<string, { bg: string; text: string }> = {
  AMER: { bg: 'bg-blue-100', text: 'text-blue-700' },
  EMEA: { bg: 'bg-green-100', text: 'text-green-700' },
  APAC: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

function regionBadge(region: string) {
  const colors = REGION_COLORS[region] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={`${colors.bg} ${colors.text} text-[9px] font-bold px-1.5 py-0.5 rounded`}>
      {region}
    </span>
  );
}

function resourceSummary(metro: EnvironmentInventoryMetro) {
  const parts: string[] = [];
  if (metro.portCount > 0) parts.push(`${metro.portCount}P`);
  if (metro.connectionCount > 0) parts.push(`${metro.connectionCount}C`);
  if (metro.routerCount > 0) parts.push(`${metro.routerCount}R`);
  if (metro.deviceCount > 0) parts.push(`${metro.deviceCount}D`);
  return parts.join(' \u00B7 ');
}

function progressIcon(status: MetroProgress) {
  switch (status) {
    case 'pending':
      return <span className="text-gray-400 text-xs">\u2014</span>;
    case 'importing':
      return (
        <svg className="w-4 h-4 animate-spin text-equinix-green" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
        </svg>
      );
    case 'done':
      return <span className="text-equinix-green text-sm font-bold">\u2713</span>;
    case 'error':
      return <span className="text-equinix-red text-sm font-bold">\u2717</span>;
  }
}

export function EnvironmentImportDialog({ open, onClose }: EnvironmentImportDialogProps) {
  const {
    phase,
    inventory,
    selectedMetros,
    progress,
    errors,
    importSummary,
    fetchInventory,
    toggleMetro,
    selectAll,
    deselectAll,
    importSelected,
    reset,
  } = useEnvironmentImport();

  // Start fetching when dialog opens
  useEffect(() => {
    if (open && phase === 'idle') {
      fetchInventory();
    }
  }, [open, phase, fetchInventory]);

  // Reset state when dialog closes
  const handleClose = () => {
    if (phase === 'importing') return; // prevent close during import
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900">Import Existing Environment</h2>
          {phase !== 'importing' && (
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {renderPhaseContent(phase, {
            inventory,
            selectedMetros,
            progress,
            errors,
            importSummary,
            toggleMetro,
            selectAll,
            deselectAll,
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          {phase === 'selecting' && (
            <>
              <button onClick={handleClose} className="px-3 py-1.5 text-[10px] font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={importSelected}
                disabled={selectedMetros.length === 0}
                className="px-3 py-1.5 text-[10px] font-medium rounded-md bg-equinix-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import {selectedMetros.length} Metro{selectedMetros.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {(phase === 'complete' || phase === 'error') && (
            <button onClick={handleClose} className="px-3 py-1.5 text-[10px] font-medium rounded-md bg-equinix-black text-white hover:bg-gray-800 transition-colors">
              Close
            </button>
          )}
          {phase === 'error' && !importSummary && (
            <button
              onClick={fetchInventory}
              className="px-3 py-1.5 text-[10px] font-medium rounded-md bg-equinix-red text-white hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function renderPhaseContent(
  phase: ImportPhase,
  ctx: {
    inventory: ReturnType<typeof useEnvironmentImport>['inventory'];
    selectedMetros: string[];
    progress: ReturnType<typeof useEnvironmentImport>['progress'];
    errors: string[];
    importSummary: ReturnType<typeof useEnvironmentImport>['importSummary'];
    toggleMetro: (code: string) => void;
    selectAll: () => void;
    deselectAll: () => void;
  }
) {
  switch (phase) {
    case 'idle':
    case 'fetching-inventory':
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <svg className="w-8 h-8 animate-spin text-equinix-green" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
          <p className="text-xs text-gray-500">Fetching your Equinix environment...</p>
        </div>
      );

    case 'selecting': {
      const inv = ctx.inventory;
      if (!inv) return null;
      return (
        <div>
          {/* Summary counts */}
          <div className="flex items-center gap-4 mb-3 text-[10px] text-gray-500">
            <span>{inv.totalPorts} Ports</span>
            <span>{inv.totalConnections} Connections</span>
            <span>{inv.totalRouters} Routers</span>
            <span>{inv.totalDevices} Devices</span>
          </div>

          {/* Select All / Deselect All */}
          <div className="flex items-center gap-2 mb-2">
            <button onClick={ctx.selectAll} className="text-[10px] font-medium text-equinix-green hover:underline">Select All</button>
            <span className="text-gray-300">|</span>
            <button onClick={ctx.deselectAll} className="text-[10px] font-medium text-gray-500 hover:underline">Deselect All</button>
            <span className="ml-auto text-[10px] text-gray-400">{ctx.selectedMetros.length} of {inv.metros.length} selected</span>
          </div>

          {/* Metro list */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {inv.metros.map((metro) => {
              const checked = ctx.selectedMetros.includes(metro.metroCode);
              return (
                <label
                  key={metro.metroCode}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${checked ? 'bg-green-50/50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => ctx.toggleMetro(metro.metroCode)}
                    className="accent-equinix-green w-3.5 h-3.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">{metro.metroCode}</span>
                      <span className="text-[10px] text-gray-500 truncate">{metro.metroName}</span>
                      {regionBadge(metro.region)}
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">{resourceSummary(metro)}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    case 'importing':
      return (
        <div>
          <p className="text-xs text-gray-500 mb-3">Importing resources into your project...</p>
          <div className="space-y-1.5">
            {Object.entries(ctx.progress).map(([code, status]) => (
              <div key={code} className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-50">
                <div className="w-5 flex justify-center">{progressIcon(status)}</div>
                <span className="text-xs font-medium text-gray-700">{code}</span>
                <span className="text-[10px] text-gray-400 capitalize">{status}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'complete': {
      const s = ctx.importSummary;
      return (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-equinix-green text-lg font-bold">\u2713</span>
            <span className="text-sm font-bold text-gray-900">Import Complete</span>
          </div>
          {s && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-gray-50 rounded px-3 py-2">
                <p className="text-[10px] text-gray-400">Ports</p>
                <p className="text-sm font-bold text-gray-900">{s.portsImported}</p>
              </div>
              <div className="bg-gray-50 rounded px-3 py-2">
                <p className="text-[10px] text-gray-400">Routers</p>
                <p className="text-sm font-bold text-gray-900">{s.routersImported}</p>
              </div>
              <div className="bg-gray-50 rounded px-3 py-2">
                <p className="text-[10px] text-gray-400">Devices</p>
                <p className="text-sm font-bold text-gray-900">{s.devicesImported}</p>
              </div>
              <div className="bg-gray-50 rounded px-3 py-2">
                <p className="text-[10px] text-gray-400">Connections</p>
                <p className="text-sm font-bold text-gray-900">{s.connectionsImported}</p>
              </div>
            </div>
          )}
          {s && s.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
              <p className="text-[10px] font-bold text-yellow-700 mb-1">Warnings</p>
              <ul className="text-[9px] text-yellow-600 space-y-0.5">
                {s.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    case 'error':
      return (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-equinix-red text-lg font-bold">\u2717</span>
            <span className="text-sm font-bold text-gray-900">
              {ctx.importSummary ? 'Import Completed with Errors' : 'Error'}
            </span>
          </div>
          {ctx.errors.map((err, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded px-3 py-2 mb-2">
              <p className="text-[10px] text-red-700">{err}</p>
            </div>
          ))}
          {ctx.importSummary && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-gray-50 rounded px-3 py-2">
                <p className="text-[10px] text-gray-400">Ports</p>
                <p className="text-sm font-bold text-gray-900">{ctx.importSummary.portsImported}</p>
              </div>
              <div className="bg-gray-50 rounded px-3 py-2">
                <p className="text-[10px] text-gray-400">Connections</p>
                <p className="text-sm font-bold text-gray-900">{ctx.importSummary.connectionsImported}</p>
              </div>
            </div>
          )}
        </div>
      );
  }
}
