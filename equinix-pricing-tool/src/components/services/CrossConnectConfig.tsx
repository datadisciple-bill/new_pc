import type { ServiceSelection, CrossConnectConfig as XCConfig } from '@/types/config';
import { ServiceCard } from './ServiceCard';
import {
  CROSS_CONNECT_MEDIA_TYPES,
  CROSS_CONNECT_CONNECTOR_TYPES,
  CROSS_CONNECT_PROTOCOLS,
} from '@/constants/serviceDefaults';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function CrossConnectConfig({ service, onUpdate, onRemove }: Props) {
  const config = service.config as XCConfig;

  return (
    <ServiceCard
      serviceId={service.id}
      title="Cross Connect"
      pricing={service.pricing}
      onRemove={onRemove}
      quantity={config.quantity}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Media Type</label>
            <select
              value={config.connectionService}
              onChange={(e) => onUpdate({ connectionService: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              {CROSS_CONNECT_MEDIA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Connector</label>
            <select
              value={config.connectorType}
              onChange={(e) => onUpdate({ connectorType: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              {CROSS_CONNECT_CONNECTOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Protocol</label>
          <select
            value={config.protocolType}
            onChange={(e) => onUpdate({ protocolType: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            {CROSS_CONNECT_PROTOCOLS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={48}
              value={config.quantity}
              onChange={(e) => {
                const qty = Math.max(1, Math.min(48, parseInt(e.target.value) || 1));
                onUpdate({ quantity: qty });
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">MRC per unit</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                min={0}
                step={50}
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
      </div>
    </ServiceCard>
  );
}
