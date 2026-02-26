import { memo, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CorePriceEntry } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';
import { getTermDiscountPercent } from '@/constants/serviceDefaults';
import { useConfigStore } from '@/store/configStore';

interface NEPriceTableNodeData {
  serviceId: string;
  metroCode: string;
  serviceName: string;
  selectedCores: string;
  priceTable: CorePriceEntry[];
  termLength: number;
  [key: string]: unknown;
}

export const NEPriceTableNode = memo(function NEPriceTableNode({ data }: NodeProps) {
  const { serviceId, metroCode, serviceName, selectedCores, priceTable, termLength } = data as NEPriceTableNodeData;
  const discountPct = getTermDiscountPercent(termLength ?? 1);
  const updateServiceConfig = useConfigStore((s) => s.updateServiceConfig);

  const handleClose = useCallback(() => {
    updateServiceConfig(metroCode, serviceId, { showPriceTable: false, priceTable: null });
  }, [metroCode, serviceId, updateServiceConfig]);

  return (
    <div className="bg-white border border-gray-300 rounded-md shadow-sm overflow-hidden relative group" style={{ width: '100%' }}>
      <div className="bg-equinix-black text-white px-2 py-1 flex items-center">
        <p className="text-[9px] font-bold truncate flex-1">{serviceName} — Size Options</p>
        <button
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          className="ml-1 flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white text-[9px] leading-none"
          title="Hide price table"
        >
          ×
        </button>
      </div>
      {discountPct > 0 && (
        <div className="px-2 py-0.5 bg-red-50">
          <p className="text-[8px] text-red-600 font-semibold">{discountPct}% Term Discount</p>
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
