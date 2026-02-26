import type { ReactNode } from 'react';
import type { PricingResult } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';

interface Props {
  title: string;
  pricing: PricingResult | null;
  onRemove: () => void;
  quoteRequired?: boolean;
  quantity?: number;
  hidePricing?: boolean;
  children: ReactNode;
}

export function ServiceCard({ title, pricing, onRemove, quoteRequired, quantity = 1, hidePricing, children }: Props) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header bar — Equinix black */}
      <div className="bg-equinix-black text-white px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-bold">{title}</span>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-white transition-colors"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
