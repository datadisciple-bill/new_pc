import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { BandwidthPriceEntry } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';

interface PriceTableNodeData {
  connectionName: string;
  selectedBandwidthMbps: number;
  priceTable: BandwidthPriceEntry[];
  [key: string]: unknown;
}

export const PriceTableNode = memo(function PriceTableNode({ data }: NodeProps) {
  const { connectionName, selectedBandwidthMbps, priceTable } = data as PriceTableNodeData;

  return (
    <div className="bg-white border border-gray-300 rounded-md shadow-sm overflow-hidden" style={{ width: '100%' }}>
      <div className="bg-equinix-green text-white px-2 py-1">
        <p className="text-[9px] font-bold truncate">{connectionName} — Price Table</p>
      </div>
      <table className="w-full text-[8px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-1.5 py-0.5 text-gray-600 font-bold">Bandwidth</th>
            <th className="text-right px-1.5 py-0.5 text-gray-600 font-bold">MRC</th>
          </tr>
        </thead>
        <tbody>
          {priceTable.map((entry) => (
            <tr
              key={entry.bandwidthMbps}
              className={entry.bandwidthMbps === selectedBandwidthMbps
                ? 'bg-green-100 font-bold'
                : ''}
            >
              <td className="px-1.5 py-px text-gray-700">
                {entry.bandwidthMbps === selectedBandwidthMbps ? '► ' : ''}
                {entry.label}
              </td>
              <td className="px-1.5 py-px text-right text-gray-700">
                {formatCurrency(entry.mrc)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
