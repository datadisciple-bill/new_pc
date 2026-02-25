import type { ServiceSelection, ColocationConfig as ColoConfig } from '@/types/config';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function ColocationConfig({ service, onUpdate, onRemove }: Props) {
  const config = service.config as ColoConfig;

  return (
    <ServiceCard title="Colocation" pricing={service.pricing} onRemove={onRemove}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
          <input
            type="text"
            value={config.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="e.g., 1/4 Cage, Full Cabinet"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Price (MRC)</label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              min={0}
              step={100}
              value={config.mrcPrice}
              onChange={(e) => {
                const mrc = Math.max(0, parseFloat(e.target.value) || 0);
                onUpdate({ mrcPrice: mrc });
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>
    </ServiceCard>
  );
}
