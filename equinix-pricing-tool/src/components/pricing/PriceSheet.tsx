import { useState } from 'react';
import { usePricing } from '@/hooks/usePricing';
import { PriceSummary } from './PriceSummary';
import { formatCurrency } from '@/utils/priceCalculator';
import type { PriceLineItem } from '@/types/pricing';

function StatusDot({ item }: { item: PriceLineItem }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const timestamp = item.fetchedAt
    ? new Date(item.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  const dotColor = item.isEstimate ? 'bg-amber-500' : 'bg-green-600';
  const label = item.isEstimate ? 'Estimated' : 'Verified';
  const tooltipText = timestamp ? `${label} ${timestamp}` : label;

  return (
    <td className="px-1.5 py-2 text-center relative">
      <button
        className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-gray-100 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        aria-label={tooltipText}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      </button>
      {showTooltip && (
        <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap pointer-events-none">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </td>
  );
}

export function PriceSheet() {
  const { summary } = usePricing();

  if (summary.metroSubtotals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm p-8">
        Add services to see pricing
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 overflow-auto">
      {summary.metroSubtotals.map((metro) => (
        <div key={metro.metroCode} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Metro header */}
          <div className="bg-equinix-gray px-3 py-2 border-b border-gray-200">
            <span className="font-bold text-sm text-equinix-navy">
              {metro.metroCode} — {metro.metroName}
            </span>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="w-6 px-1.5 py-2" aria-label="Status" />
                  <th className="text-left px-3 py-2 font-medium">Service</th>
                  <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Details</th>
                  <th className="text-left px-3 py-2 font-medium">Term</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">MRC</th>
                  <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">NRC</th>
                </tr>
              </thead>
              <tbody>
                {metro.lineItems.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <StatusDot item={item} />
                    <td className="px-3 py-2 font-medium text-equinix-navy">
                      {item.serviceType}
                      <span className="block sm:hidden text-gray-500 font-normal">{item.description}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 hidden sm:table-cell">{item.description}</td>
                    <td className="px-3 py-2 text-gray-600">{item.term}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {item.isEstimate && item.mrc === 0 ? (
                        <span className="text-amber-500">Quote</span>
                      ) : (
                        formatCurrency(item.mrc)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">
                      {item.nrc > 0 ? formatCurrency(item.nrc) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="px-1.5 py-2" />
                  <td className="px-3 py-2" colSpan={3}>Subtotal</td>
                  <td className="px-3 py-2 text-right" />
                  <td className="px-3 py-2 text-right">{formatCurrency(metro.mrc)}</td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell">{formatCurrency(metro.nrc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      <PriceSummary summary={summary} />
    </div>
  );
}
