import type { ServiceSelection, NspConfig as NspConfigType } from '@/types/config';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function NspConfig({ service, onUpdate, onRemove }: Props) {
  const config = service.config as NspConfigType;

  return (
    <ServiceCard title="Network Service Provider" pricing={service.pricing} onRemove={onRemove} hidePricing>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Provider Name</label>
        <input
          type="text"
          value={config.providerName}
          onChange={(e) => onUpdate({ providerName: e.target.value })}
          placeholder="e.g., AT&T, Verizon, Lumen"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">No charge — customer does not pay for this service</p>
    </ServiceCard>
  );
}
