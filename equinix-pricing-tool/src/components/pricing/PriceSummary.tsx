import type { PricingSummary } from '@/types/pricing';
import { formatCurrency } from '@/utils/priceCalculator';

interface Props {
  summary: PricingSummary;
}

export function PriceSummary({ summary }: Props) {
  return (
    <div className="bg-equinix-black text-white rounded-lg p-4 space-y-2">
      <h3 className="font-bold text-sm">Grand Total</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-400">Monthly (MRC)</p>
          <p className="text-lg font-bold text-equinix-green">
            {formatCurrency(summary.totalMrc)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">One-Time (NRC)</p>
          <p className="text-lg font-bold">
            {formatCurrency(summary.totalNrc)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Annual Cost</p>
          <p className="text-lg font-bold text-equinix-green">
            {formatCurrency(summary.totalAnnualCost)}
          </p>
        </div>
      </div>
    </div>
  );
}
