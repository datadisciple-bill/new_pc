import { usePricing } from '@/hooks/usePricing';

export function CsvExport() {
  const { exportCsv, summary } = usePricing();
  const hasItems = summary.metroSubtotals.some((m) => m.lineItems.length > 0);

  return (
    <button
      onClick={exportCsv}
      disabled={!hasItems}
      className="flex items-center gap-2 px-4 py-2 bg-equinix-green text-white rounded-md font-medium text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      Export CSV
    </button>
  );
}
