import { useServices } from '@/hooks/useServices';
import { usePricing } from '@/hooks/usePricing';
import { FabricPortConfig } from './FabricPortConfig';
import { NetworkEdgeConfig } from './NetworkEdgeConfig';
import { InternetAccessConfig } from './InternetAccessConfig';
import { CloudRouterConfig } from './CloudRouterConfig';
import { useConfigStore } from '@/store/configStore';
import type { ServiceType, ServiceSelection } from '@/types/config';
import { SERVICE_TYPE_LABELS } from '@/constants/brandColors';

const SERVICE_TYPES: ServiceType[] = ['FABRIC_PORT', 'NETWORK_EDGE', 'INTERNET_ACCESS', 'CLOUD_ROUTER'];

interface Props {
  metroCode: string;
}

export function ServiceSelector({ metroCode }: Props) {
  const { services, addService, removeService, updateConfig, deviceTypes } = useServices(metroCode);
  const { fetchPriceForService } = usePricing();
  const metro = useConfigStore((s) =>
    s.project.metros.find((m) => m.metroCode === metroCode)
  );

  const renderServiceConfig = (service: ServiceSelection) => {
    const common = {
      key: service.id,
      service,
      metroCode,
      onUpdate: (config: Record<string, unknown>) => {
        updateConfig(service.id, config);
        // Debounced pricing fetch would be better, but this works for now
        const updatedService = {
          ...service,
          config: { ...service.config, ...config },
        };
        fetchPriceForService(metroCode, updatedService);
      },
      onRemove: () => removeService(service.id),
    };

    switch (service.type) {
      case 'FABRIC_PORT':
        return <FabricPortConfig {...common} />;
      case 'NETWORK_EDGE':
        return <NetworkEdgeConfig {...common} deviceTypes={deviceTypes} />;
      case 'INTERNET_ACCESS':
        return <InternetAccessConfig {...common} />;
      case 'CLOUD_ROUTER':
        return <CloudRouterConfig {...common} />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="font-bold text-sm text-equinix-navy">
          {metro?.metroName} ({metroCode})
        </h3>
      </div>

      {/* Add service buttons */}
      <div className="flex gap-2 px-4 flex-wrap">
        {SERVICE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => {
              const id = addService(type);
              // Fetch initial pricing
              const newService = useConfigStore.getState().project.metros
                .find((m) => m.metroCode === metroCode)
                ?.services.find((s) => s.id === id);
              if (newService) fetchPriceForService(metroCode, newService);
            }}
            className="px-3 py-1.5 text-xs font-medium bg-equinix-black text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            + {SERVICE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="space-y-3 px-4 pb-4">
        {services.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            No services configured. Add a service above.
          </p>
        )}
        {services.map(renderServiceConfig)}
      </div>
    </div>
  );
}
