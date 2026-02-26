import type { ServiceSelection, InternetAccessConfig as IAConfig } from '@/types/config';
import { BANDWIDTH_OPTIONS } from '@/constants/serviceDefaults';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function InternetAccessConfig({ service, onUpdate, onRemove }: Props) {
  const config = service.config as IAConfig;

  return (
    <ServiceCard
      serviceId={service.id}
      title="Internet Access"
      pricing={service.pricing}
      onRemove={onRemove}
      quoteRequired
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bandwidth</label>
          <select
            value={config.bandwidthMbps}
            onChange={(e) => onUpdate({ bandwidthMbps: parseInt(e.target.value) })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            {BANDWIDTH_OPTIONS.filter((b) => b <= 10000).map((b) => (
              <option key={b} value={b}>
                {b >= 1000 ? `${b / 1000} Gbps` : `${b} Mbps`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Routing</label>
          <select
            value={config.routingProtocol}
            onChange={(e) => onUpdate({ routingProtocol: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="STATIC">Static</option>
            <option value="DIRECT">Direct</option>
            <option value="BGP">BGP</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Connection</label>
          <select
            value={config.connectionType}
            onChange={(e) => onUpdate({ connectionType: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="SINGLE">Single</option>
            <option value="DUAL">Dual (Redundant)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Delivery</label>
          <select
            value={config.deliveryMethod}
            onChange={(e) => onUpdate({ deliveryMethod: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="FABRIC_PORT">Via Fabric Port</option>
            <option value="NETWORK_EDGE">Via Network Edge</option>
          </select>
        </div>
      </div>
    </ServiceCard>
  );
}
