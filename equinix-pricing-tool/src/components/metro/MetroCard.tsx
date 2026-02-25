import type { Metro } from '@/types/equinix';

interface MetroCardProps {
  metro: Metro;
  selected: boolean;
  onToggle: () => void;
  compact?: boolean;
}

const REGION_BADGE: Record<string, string> = {
  AMER: 'bg-blue-100 text-blue-700',
  EMEA: 'bg-green-100 text-green-700',
  APAC: 'bg-purple-100 text-purple-700',
};

export function MetroCard({ metro, selected, onToggle, compact }: MetroCardProps) {
  if (compact) {
    return (
      <button
        onClick={onToggle}
        className={`w-full text-left px-3 py-2 rounded-md border transition-all flex items-center justify-between gap-2 ${
          selected
            ? 'border-equinix-green bg-green-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-xs text-equinix-navy flex-shrink-0">{metro.code}</span>
          <span className="text-xs text-gray-600 truncate">{metro.name}</span>
        </div>
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? 'border-equinix-green bg-equinix-green' : 'border-gray-300'
          }`}
        >
          {selected && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
        selected
          ? 'border-equinix-green bg-green-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-equinix-navy">{metro.code}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${REGION_BADGE[metro.region] ?? ''}`}>
              {metro.region}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{metro.name}</p>
        </div>
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
            selected ? 'border-equinix-green bg-equinix-green' : 'border-gray-300'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      {metro.connectedMetros.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-1.5">
          Connected: {metro.connectedMetros.slice(0, 3).map((c) => c.code).join(', ')}
          {metro.connectedMetros.length > 3 && ` +${metro.connectedMetros.length - 3}`}
        </p>
      )}
    </button>
  );
}
