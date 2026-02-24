import { usePricing } from '@/hooks/usePricing';
import { PriceSummary } from './PriceSummary';
import { formatCurrency } from '@/utils/priceCalculator';

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
                  <th className="text-left px-3 py-2 font-medium">Service</th>
                  <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Details</th>
                  <th className="text-left px-3 py-2 font-medium">Term</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">MRC</th>
                  <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">NRC</th>
                  <th className="text-right px-3 py-2 font-medium">Annual</th>
                </tr>
              </thead>
              <tbody>
                {metro.lineItems.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
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
                    <td className="px-3 py-2 text-right font-medium">
                      {item.isEstimate && item.mrc === 0 ? (
                        <span className="text-amber-500">—</span>
                      ) : (
                        formatCurrency(item.annualCost)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="px-3 py-2" colSpan={3}>Subtotal</td>
                  <td className="px-3 py-2 text-right" />
                  <td className="px-3 py-2 text-right">{formatCurrency(metro.mrc)}</td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell">{formatCurrency(metro.nrc)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(metro.annualCost)}</td>
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
