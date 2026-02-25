import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CorePriceEntry } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';
import { getTermDiscountPercent } from '@/constants/serviceDefaults';

interface NEPriceTableNodeData {
  serviceName: string;
  selectedCores: string;
  priceTable: CorePriceEntry[];
  termLength: number;
  [key: string]: unknown;
}

export const NEPriceTableNode = memo(function NEPriceTableNode({ data }: NodeProps) {
  const { serviceName, selectedCores, priceTable, termLength } = data as NEPriceTableNodeData;
  const discountPct = getTermDiscountPercent(termLength ?? 1);

  return (
    <div className="bg-white border border-gray-300 rounded-md shadow-sm overflow-hidden" style={{ width: '100%' }}>
      <div className="bg-equinix-black text-white px-2 py-1">
        <p className="text-[9px] font-bold truncate">{serviceName} — Size Options</p>
      </div>
      {discountPct > 0 && (
        <div className="px-2 py-0.5 bg-red-50">
          <p className="text-[8px] text-red-600 font-semibold">{discountPct}% term discount</p>
        </div>
      )}
      <table className="w-full text-[8px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-1.5 py-0.5 text-gray-600 font-bold">Size</th>
            <th className="text-right px-1.5 py-0.5 text-gray-600 font-bold">MRC</th>
            <th className="text-right px-1.5 py-0.5 text-gray-600 font-bold">NRC</th>
          </tr>
        </thead>
        <tbody>
          {priceTable.map((entry) => {
            const isSelected = `${entry.cores}` === selectedCores;
            return (
              <tr key={entry.cores} className={isSelected ? 'bg-green-100 font-bold' : ''}>
                <td className="px-1.5 py-px text-gray-700">
                  {isSelected ? '> ' : ''}{entry.cores} vCPU
                </td>
                <td className="px-1.5 py-px text-right text-gray-700">
                  {formatCurrency(entry.mrc)}
                </td>
                <td className="px-1.5 py-px text-right text-gray-700">
                  {formatCurrency(entry.nrc)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
