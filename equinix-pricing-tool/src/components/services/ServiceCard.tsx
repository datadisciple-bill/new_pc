import { type ReactNode, useRef, useEffect } from 'react';
import type { PricingResult } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';
import { useConfigStore } from '@/store/configStore';
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton';

interface Props {
  serviceId?: string;
  title: string;
  pricing: PricingResult | null;
  onRemove: () => void;
  quoteRequired?: boolean;
  quantity?: number;
  hidePricing?: boolean;
  children: ReactNode;
}

export function ServiceCard({ serviceId, title, pricing, onRemove, quoteRequired, quantity = 1, hidePricing, children }: Props) {
  const highlightedServiceId = useConfigStore((s) => s.ui.highlightedServiceId);
  const clearHighlight = useConfigStore((s) => s.clearHighlight);
  const isHighlighted = serviceId != null && serviceId === highlightedServiceId;
  const cardRef = useRef<HTMLDivElement>(null);

  // A service is "configured" once it has pricing (fetched on add/edit)
  const isConfigured = pricing !== null || quoteRequired === true;

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => clearHighlight(), 2500);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted, clearHighlight]);

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

        {/* Pricing display */}
        {!hidePricing && (
        <div className="border-t border-gray-100 pt-2">
          {quoteRequired ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-600 font-medium">Quote Required — Contact Equinix</span>
            </div>
          ) : pricing ? (
            <div className="text-xs space-y-0.5">
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
                {pricing.isEstimate && (
                  <span className="text-[10px] text-amber-500">est.</span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Calculating...</span>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
