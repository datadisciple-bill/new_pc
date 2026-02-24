import type { ServiceSelection, FabricPortConfig as FPConfig } from '@/types/config';
import { PORT_SPEEDS } from '@/constants/serviceDefaults';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function FabricPortConfig({ service, onUpdate, onRemove }: Props) {
  const config = service.config as FPConfig;

  return (
    <ServiceCard title="Fabric Port" pricing={service.pricing} onRemove={onRemove}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Speed</label>
          <select
            value={config.speed}
            onChange={(e) => onUpdate({ speed: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            {PORT_SPEEDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={config.type}
            onChange={(e) => onUpdate({ type: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="SINGLE">Single</option>
            <option value="REDUNDANT">Redundant (LAG)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Encapsulation</label>
          <select
            value={config.encapsulation}
            onChange={(e) => onUpdate({ encapsulation: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="DOT1Q">Dot1q</option>
            <option value="QINQ">QinQ</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            max={10}
            value={config.quantity}
            onChange={(e) => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>
      </div>
    </ServiceCard>
  );
}
