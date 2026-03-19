import { type ReactNode, useRef, useEffect, useState } from 'react';
import type { PricingResult } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';
import { useConfigStore } from '@/store/configStore';
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton';

interface Props {
  serviceId?: string;
  metroCode?: string;
  title: string;
  pricing: PricingResult | null;
  onRemove: () => void;
  onRetry?: () => void;
  quoteRequired?: boolean;
  quantity?: number;
  hidePricing?: boolean;
  children: ReactNode;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ServiceCard({ serviceId, metroCode, title, pricing, onRemove, onRetry, quoteRequired, quantity = 1, hidePricing, children }: Props) {
  const highlightedServiceId = useConfigStore((s) => s.ui.highlightedServiceId);
  const clearHighlight = useConfigStore((s) => s.clearHighlight);
  const pricingError = useConfigStore((s) => serviceId ? s.ui.pricingErrors[serviceId] : undefined);
  const setManualPrice = useConfigStore((s) => s.setManualPrice);
  const isHighlighted = serviceId != null && serviceId === highlightedServiceId;
  const cardRef = useRef<HTMLDivElement>(null);

  const [manualMrc, setManualMrc] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // A service is "configured" once it has pricing (fetched on add/edit)
  const isConfigured = pricing !== null || quoteRequired === true;

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => clearHighlight(), 2500);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted, clearHighlight]);

  const handleManualApply = () => {
    const value = parseFloat(manualMrc);
    if (!isNaN(value) && value >= 0 && serviceId && metroCode) {
      setManualPrice(metroCode, serviceId, value);
      setManualMrc('');
      setShowManualInput(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`border rounded-lg overflow-hidden transition-all duration-300 ${
        isHighlighted
          ? 'border-blue-400 ring-2 ring-blue-300 shadow-lg'
          : 'border-gray-200'
      }`}
    >
      {/* Header bar — Equinix black */}
      <div className="bg-equinix-black text-white px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold flex-1 truncate">{title}</span>
        <ConfirmDeleteButton
          onDelete={onRemove}
          requiresConfirm={isConfigured}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          confirmClassName="text-white"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </ConfirmDeleteButton>
      </div>

      {/* Config body */}
      <div className="p-3 space-y-3">
        {children}

        {/* Pricing display — 3-state: loading / error / success */}
        {!hidePricing && (
        <div className="border-t border-gray-100 pt-2">
          {quoteRequired ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" aria-label="Quote required" />
              <span className="text-xs text-amber-600 font-medium">Quote Required — Contact Equinix</span>
            </div>
          ) : pricingError && !pricing ? (
            /* STATE: ERROR — price fetch failed */
            <div className="space-y-1.5" role="alert">
              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" aria-label="Price error" />
                  <span className="text-[11px] text-red-600 font-medium">Price unavailable</span>
                </div>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    aria-label="Retry price fetch"
                    className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </button>
                )}
              </div>
              {showManualInput ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500">MRC:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualMrc}
                    onChange={(e) => setManualMrc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualApply()}
                    aria-label="Enter monthly recurring cost manually"
                    className="w-24 px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="0.00"
                    autoFocus
                  />
                  <button
                    onClick={handleManualApply}
                    className="text-[11px] px-2 py-1 rounded bg-equinix-black text-white font-medium hover:bg-gray-800"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowManualInput(false)}
                    className="text-[11px] px-1.5 py-1 rounded text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowManualInput(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  Enter price manually
                </button>
              )}
            </div>
          ) : pricing ? (
            /* STATE: SUCCESS — price available */
            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  MRC: <span className="font-medium text-gray-900">{formatCurrency(pricing.mrc)}</span>
                  {quantity > 1 && (
                    <span className="text-gray-500"> x{quantity} = <span className="font-medium text-gray-900">{formatCurrency(pricing.mrc * quantity)}</span></span>
                  )}
                </span>
                {pricing.nrc > 0 && (
                  <span className="text-gray-500">
                    NRC: <span className="font-medium text-gray-900">{formatCurrency(pricing.nrc)}</span>
                  </span>
                )}
              </div>
              {/* Trust badge */}
              <div className="flex items-center gap-1.5">
                {pricing.isEstimate ? (
                  pricing.breakdown[0]?.description === 'Manual entry' ? (
                    <>
                      <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span className="text-[11px] text-gray-400" aria-label="Manual price entry">Manual entry</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" aria-label="Estimated price" />
                      <span className="text-[11px] text-gray-400">
                        Estimated
                        {pricing.fetchedAt && <> · {formatTimestamp(pricing.fetchedAt)}</>}
                      </span>
                    </>
                  )
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" aria-label="Verified price" />
                    <span className="text-[11px] text-gray-400">
                      Verified
                      {pricing.fetchedAt && <> · {formatTimestamp(pricing.fetchedAt)}</>}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* STATE: LOADING — awaiting price fetch */
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
              <span className="text-xs text-gray-400">Calculating...</span>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
