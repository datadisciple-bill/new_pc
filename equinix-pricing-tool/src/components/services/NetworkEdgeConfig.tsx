import { useState, useEffect, useCallback } from 'react';
import type { ServiceSelection, NetworkEdgeConfig as NEConfig, CorePriceEntry } from '@/types/config';
import type { DeviceType } from '@/types/equinix';
import { TERM_OPTIONS } from '@/constants/serviceDefaults';
import { fetchNetworkEdgePricing } from '@/api/networkEdge';
import { formatCurrency } from '@/utils/priceCalculator';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  deviceTypes: DeviceType[];
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
  onPricingFetched?: () => void;
}

export function NetworkEdgeConfig({ service, metroCode, deviceTypes, onUpdate, onRemove, onPricingFetched }: Props) {
  const config = service.config as NEConfig;
  const selectedDevice = deviceTypes.find((d) => d.deviceTypeCode === config.deviceTypeCode);

  const [showPriceTable, setShowPriceTable] = useState(config.showPriceTable ?? false);
  const [priceTable, setPriceTable] = useState<CorePriceEntry[]>(config.priceTable ?? []);
  const [loadingTable, setLoadingTable] = useState(false);

  const fetchPriceTable = useCallback(async () => {
    if (!selectedDevice || !config.deviceTypeCode) return;
    setLoadingTable(true);
    try {
      const entries: CorePriceEntry[] = [];
      for (const cores of selectedDevice.coreCounts) {
        const result = await fetchNetworkEdgePricing(
          config.deviceTypeCode,
          `${cores}`,
          config.termLength,
          metroCode
        );
        entries.push({ cores, mrc: result.monthlyRecurring, nrc: result.nonRecurring });
      }
      setPriceTable(entries);
      // Persist to store so diagram can show it
      onUpdate({ showPriceTable: true, priceTable: entries });
    } catch {
      setPriceTable([]);
    }
    setLoadingTable(false);
  }, [selectedDevice, config.deviceTypeCode, config.termLength, metroCode, onUpdate]);

  useEffect(() => {
    if (showPriceTable && selectedDevice && priceTable.length === 0) {
      fetchPriceTable();
    }
  }, [showPriceTable, fetchPriceTable, selectedDevice, priceTable.length]);

  const handleTogglePriceTable = (checked: boolean) => {
    setShowPriceTable(checked);
    if (!checked) {
      setPriceTable([]);
      onUpdate({ showPriceTable: false, priceTable: null });
    } else {
      onUpdate({ showPriceTable: true });
    }
  };

  const handleSelectCore = (cores: number) => {
    onUpdate({ packageCode: `${cores}` });
    onPricingFetched?.();
  };

  return (
    <ServiceCard title="Network Edge" pricing={service.pricing} onRemove={onRemove}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Device Type</label>
          <select
            value={config.deviceTypeCode}
            onChange={(e) => {
              const dt = deviceTypes.find((d) => d.deviceTypeCode === e.target.value);
              onUpdate({
                deviceTypeCode: e.target.value,
                deviceTypeName: dt?.name ?? '',
                vendorName: dt?.vendor ?? '',
                packageCode: dt ? `${dt.coreCounts[0]}` : '',
              });
              setPriceTable([]);
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="">Select device...</option>
            {deviceTypes.map((dt) => (
              <option key={dt.deviceTypeCode} value={dt.deviceTypeCode}>
                {dt.vendor} — {dt.name}
              </option>
            ))}
          </select>
        </div>

        {selectedDevice && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Package (Cores)</label>
                <select
                  value={config.packageCode}
                  onChange={(e) => onUpdate({ packageCode: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  {selectedDevice.coreCounts.map((c) => (
                    <option key={c} value={`${c}`}>{c} vCPU</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">License</label>
                <select
                  value={config.licenseType}
                  onChange={(e) => onUpdate({ licenseType: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="SUBSCRIPTION">Subscription</option>
                  <option value="BYOL">BYOL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Term</label>
                <select
                  value={config.termLength}
                  onChange={(e) => onUpdate({ termLength: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.redundant}
                    onChange={(e) => onUpdate({ redundant: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">HA Pair</span>
                </label>
              </div>
            </div>

            {selectedDevice.softwarePackages.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Software</label>
                <select
                  value={config.softwareVersion}
                  onChange={(e) => onUpdate({ softwareVersion: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="">Default</option>
                  {selectedDevice.softwarePackages.map((sp) => (
                    <option key={sp.code} value={sp.code}>{sp.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Price table toggle */}
            <div className="border-t border-gray-100 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPriceTable}
                  onChange={(e) => handleTogglePriceTable(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-equinix-green"
                />
                <span className="text-[10px] text-gray-500">Show size/price table</span>
              </label>
              {showPriceTable && (
                <div className="mt-2 overflow-x-auto">
                  {loadingTable ? (
                    <p className="text-[10px] text-gray-400">Loading prices...</p>
                  ) : priceTable.length > 0 ? (
                    <>
                      <p className="text-[9px] text-gray-400 mb-1">Click a row to change size</p>
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-1.5 py-1 text-gray-500 font-medium">Size</th>
                            <th className="text-right px-1.5 py-1 text-gray-500 font-medium">MRC</th>
                            <th className="text-right px-1.5 py-1 text-gray-500 font-medium">NRC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceTable.map((entry) => {
                            const isSelected = `${entry.cores}` === config.packageCode;
                            return (
                              <tr
                                key={entry.cores}
                                onClick={() => handleSelectCore(entry.cores)}
                                className={`cursor-pointer ${isSelected ? 'bg-green-50 font-bold' : 'hover:bg-gray-50'}`}
                              >
                                <td className="px-1.5 py-0.5 text-gray-700">{entry.cores} vCPU</td>
                                <td className="px-1.5 py-0.5 text-right text-gray-700">{formatCurrency(entry.mrc)}</td>
                                <td className="px-1.5 py-0.5 text-right text-gray-700">{formatCurrency(entry.nrc)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-400">No pricing data available</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ServiceCard>
  );
}
