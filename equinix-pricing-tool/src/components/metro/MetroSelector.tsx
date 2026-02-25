import { useState, useMemo } from 'react';
import { useMetros } from '@/hooks/useMetros';
import { MetroCard } from './MetroCard';

const REGIONS = ['AMER', 'EMEA', 'APAC'] as const;
const REGION_LABELS: Record<string, string> = {
  AMER: 'Americas',
  EMEA: 'Europe, Middle East & Africa',
  APAC: 'Asia Pacific',
};

interface MetroSelectorProps {
  compact?: boolean;
}

export function MetroSelector({ compact = false }: MetroSelectorProps) {
  const { allMetros, isLoading, error, toggleMetro, isSelected } = useMetros();
  const [search, setSearch] = useState('');
  const [activeRegion, setActiveRegion] = useState<string>('ALL');

  const filteredMetros = useMemo(() => {
    let metros = allMetros;
    if (activeRegion !== 'ALL') {
      metros = metros.filter((m) => m.region === activeRegion);
    }
    if (search) {
      const q = search.toLowerCase();
      metros = metros.filter(
        (m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
      );
    }
    return metros;
  }, [allMetros, activeRegion, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-equinix-black border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md m-4">{error}</div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      {/* Search */}
      <div className={compact ? 'px-3 pt-3' : 'px-4 pt-4'}>
        <input
          type="text"
          placeholder="Search metros..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green focus:border-transparent ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
        />
      </div>

      {/* Region tabs */}
      <div className={`flex gap-1 overflow-x-auto ${compact ? 'px-3 flex-wrap' : 'px-4'}`}>
        {['ALL', ...REGIONS].map((region) => (
          <button
            key={region}
            onClick={() => setActiveRegion(region)}
            className={`font-medium rounded-full whitespace-nowrap transition-colors ${
              compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
            } ${
              activeRegion === region
                ? 'bg-equinix-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {region === 'ALL' ? 'All' : compact ? region : REGION_LABELS[region]}
          </button>
        ))}
      </div>

      {/* Metro grid */}
      <div className={`grid gap-2 pb-3 ${compact ? 'grid-cols-1 px-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4'}`}>
        {filteredMetros.map((metro) => (
          <MetroCard
            key={metro.code}
            metro={metro}
            selected={isSelected(metro.code)}
            onToggle={() => toggleMetro(metro)}
            compact={compact}
          />
        ))}
      </div>

      {filteredMetros.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">No metros found</p>
      )}
    </div>
  );
}
