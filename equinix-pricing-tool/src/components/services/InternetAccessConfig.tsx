import { useState, useCallback, useEffect } from 'react';
import type { ServiceSelection, InternetAccessConfig as IAConfig, BandwidthPriceEntry } from '@/types/config';
import { BANDWIDTH_OPTIONS } from '@/constants/serviceDefaults';
import { fetchEIAPricing } from '@/api/internetAccess';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function InternetAccessConfig({ service, metroCode, onUpdate, onRemove }: Props) {
  const config = service.config as IAConfig;

  const [showPriceTable, setShowPriceTable] = useState(config.showPriceTable ?? false);
  const [priceTable, setPriceTable] = useState<BandwidthPriceEntry[]>(config.priceTable ?? []);
  const [loadingTable, setLoadingTable] = useState(false);

  const fetchPriceTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const connectionType = config.deliveryMethod === 'COLOCATION' ? 'IA_C' as const : 'IA_VC' as const;
      const serviceType = config.connectionType === 'DUAL' ? 'DUAL_PORT' as const : 'SINGLE_PORT' as const;
      const entries: BandwidthPriceEntry[] = [];
      for (const bw of BANDWIDTH_OPTIONS) {
        if (bw > 10000) continue;
        try {
          const result = await fetchEIAPricing(metroCode, connectionType, serviceType, bw);
          entries.push({
            bandwidthMbps: bw,
            label: bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`,
            mrc: result.mrc,
            nrc: result.nrc,
            currency: result.currency,
          });
        } catch {
          entries.push({
            bandwidthMbps: bw,
            label: bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`,
            mrc: 0,
            currency: 'USD',
          });
        }
      }
      setPriceTable(entries);
      onUpdate({ showPriceTable: true, priceTable: entries });
    } catch {
      setPriceTable([]);
    }
    setLoadingTable(false);
  }, [metroCode, config.deliveryMethod, config.connectionType, onUpdate]);

  useEffect(() => {
    if (showPriceTable && priceTable.length === 0) {
      fetchPriceTable();
    }
  }, [showPriceTable, fetchPriceTable, priceTable.length]);

  const handleTogglePriceTable = (checked: boolean) => {
    setShowPriceTable(checked);
    if (!checked) {
      setPriceTable([]);
      onUpdate({ showPriceTable: false, priceTable: null });
    } else {
      onUpdate({ showPriceTable: true });
    }
  };

  return (
    <ServiceCard
      serviceId={service.id}
      title="Internet Access"
      pricing={service.pricing}
      onRemove={onRemove}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bandwidth</label>
          <select
            value={config.bandwidthMbps}
            onChange={(e) => onUpdate({ bandwidthMbps: parseInt(e.target.value) })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            {BANDWIDTH_OPTIONS.filter((b) => b <= 10000).map((b) => (
              <option key={b} value={b}>
                {b >= 1000 ? `${b / 1000} Gbps` : `${b} Mbps`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Routing</label>
          <select
            value={config.routingProtocol}
            onChange={(e) => onUpdate({ routingProtocol: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="STATIC">Static</option>
            <option value="DIRECT">Direct</option>
            <option value="BGP">BGP</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Connection</label>
          <select
            value={config.connectionType}
            onChange={(e) => onUpdate({ connectionType: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="SINGLE">Single</option>
            <option value="DUAL">Dual (Redundant)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Delivery</label>
          <select
            value={config.deliveryMethod}
            onChange={(e) => onUpdate({ deliveryMethod: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="FABRIC_PORT">Via Fabric Port</option>
            <option value="NETWORK_EDGE">Via Network Edge</option>
            <option value="COLOCATION">Via Colocation</option>
          </select>
        </div>
      </div>

      {/* Price table toggle */}
      <div className="border-t border-gray-100 pt-2 mt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showPriceTable}
            onChange={(e) => handleTogglePriceTable(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 accent-equinix-green"
          />
          <span className="text-[10px] text-gray-500">Show bandwidth/price table</span>
        </label>
        {showPriceTable && (
          <div className="mt-2 overflow-x-auto">
            {loadingTable ? (
              <p className="text-[10px] text-gray-400">Loading prices...</p>
            ) : priceTable.length > 0 ? (
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-1.5 py-1 text-gray-500 font-medium">Bandwidth</th>
                    <th className="text-right px-1.5 py-1 text-gray-500 font-medium">MRC</th>
                  </tr>
                </thead>
                <tbody>
                  {priceTable.map((entry) => {
                    const isSelected = entry.bandwidthMbps === config.bandwidthMbps;
                    return (
                      <tr
                        key={entry.bandwidthMbps}
                        className={`cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-green-50 font-bold' : ''}`}
                        onClick={() => onUpdate({ bandwidthMbps: entry.bandwidthMbps })}
                      >
                        <td className="px-1.5 py-0.5 text-gray-700">
                          {isSelected ? '> ' : ''}{entry.label}
                        </td>
                        <td className="px-1.5 py-0.5 text-right text-gray-700">
                          {entry.mrc > 0 ? `$${entry.mrc.toLocaleString()}/mo` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-[10px] text-gray-400">No pricing available</p>
            )}
          </div>
        )}
      </div>
    </ServiceCard>
  );
}
