import type { ServiceSelection, CloudRouterConfig as CRConfig } from '@/types/config';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function CloudRouterConfig({ service, onUpdate, onRemove }: Props) {
  const config = service.config as CRConfig;

  return (
    <ServiceCard serviceId={service.id} title="Fabric Cloud Router" pricing={service.pricing} onRemove={onRemove}>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Package</label>
        <select
          value={config.package}
          onChange={(e) => onUpdate({ package: e.target.value })}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        >
          <option value="STANDARD">Standard</option>
          <option value="PREMIUM">Premium</option>
        </select>
      </div>
    </ServiceCard>
  );
}
