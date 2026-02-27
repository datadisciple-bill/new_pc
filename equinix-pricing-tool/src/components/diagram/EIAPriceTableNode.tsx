import { memo, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { BandwidthPriceEntry } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';
import { useConfigStore } from '@/store/configStore';

interface EIAPriceTableNodeData {
  serviceId: string;
  metroCode: string;
  serviceName: string;
  selectedBandwidthMbps: number;
  priceTable: BandwidthPriceEntry[];
  [key: string]: unknown;
}

export const EIAPriceTableNode = memo(function EIAPriceTableNode({ data }: NodeProps) {
  const { serviceId, metroCode, serviceName, selectedBandwidthMbps, priceTable } = data as EIAPriceTableNodeData;
  const updateServiceConfig = useConfigStore((s) => s.updateServiceConfig);

  const handleClose = useCallback(() => {
    updateServiceConfig(metroCode, serviceId, { showPriceTable: false, priceTable: null });
  }, [metroCode, serviceId, updateServiceConfig]);

  return (
    <div className="bg-white border border-gray-300 rounded-md shadow-sm overflow-hidden relative group" style={{ width: '100%' }}>
      <div className="bg-equinix-black text-white px-2 py-1 flex items-center">
        <p className="text-[9px] font-bold truncate flex-1">{serviceName} — Bandwidth Options</p>
        <button
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          className="ml-1 flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white text-[9px] leading-none"
          title="Hide price table"
        >
          ×
        </button>
      </div>
      <table className="w-full text-[8px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-1.5 py-0.5 text-gray-600 font-bold">Bandwidth</th>
            <th className="text-right px-1.5 py-0.5 text-gray-600 font-bold">MRC</th>
            <th className="text-right px-1.5 py-0.5 text-gray-600 font-bold">NRC</th>
          </tr>
        </thead>
        <tbody>
          {priceTable.map((entry) => {
            const isSelected = entry.bandwidthMbps === selectedBandwidthMbps;
            return (
              <tr key={entry.bandwidthMbps} className={isSelected ? 'bg-green-100 font-bold' : ''}>
                <td className="px-1.5 py-px text-gray-700">
                  {isSelected ? '> ' : ''}{entry.label}
                </td>
                <td className="px-1.5 py-px text-right text-gray-700">
                  {formatCurrency(entry.mrc)}
                </td>
                <td className="px-1.5 py-px text-right text-gray-700">
                  {entry.nrc !== undefined ? formatCurrency(entry.nrc) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
