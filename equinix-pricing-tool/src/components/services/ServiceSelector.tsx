import { useState } from 'react';
import { useServices } from '@/hooks/useServices';
import { usePricing } from '@/hooks/usePricing';
import { FabricPortConfig } from './FabricPortConfig';
import { NetworkEdgeConfig } from './NetworkEdgeConfig';
import { InternetAccessConfig } from './InternetAccessConfig';
import { CloudRouterConfig } from './CloudRouterConfig';
import { ColocationConfig } from './ColocationConfig';
import { useConfigStore } from '@/store/configStore';
import type { ServiceType, ServiceSelection } from '@/types/config';
import { SERVICE_TYPE_LABELS } from '@/constants/brandColors';

const SERVICE_TYPES: ServiceType[] = ['FABRIC_PORT', 'NETWORK_EDGE', 'INTERNET_ACCESS', 'CLOUD_ROUTER', 'COLOCATION'];

interface Props {
  metroCode: string;
}

export function ServiceSelector({ metroCode }: Props) {
  const { services, addService, removeService, updateConfig, deviceTypes } = useServices(metroCode);
  const { fetchPriceForService, fetchPriceForConnection } = usePricing();
  const metro = useConfigStore((s) =>
    s.project.metros.find((m) => m.metroCode === metroCode)
  );
  const allMetros = useConfigStore((s) => s.project.metros);
  const copyMetroServices = useConfigStore((s) => s.copyMetroServices);
  const addConnection = useConfigStore((s) => s.addConnection);

  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const otherMetros = allMetros.filter((m) => m.metroCode !== metroCode);

  const handleCopyTo = (targetMetroCode: string) => {
    const oldToNew = copyMetroServices(metroCode, targetMetroCode);

    // Re-fetch pricing for all copied services
    const targetMetro = useConfigStore.getState().project.metros.find(
      (m) => m.metroCode === targetMetroCode
    );
    if (targetMetro) {
      for (const svc of targetMetro.services) {
        if ([...oldToNew.values()].includes(svc.id)) {
          fetchPriceForService(targetMetroCode, svc);
        }
      }
    }

    // Create connections between matching services (old → new) via Equinix Fabric
    const sourceMetro = useConfigStore.getState().project.metros.find(
      (m) => m.metroCode === metroCode
    );
    if (sourceMetro) {
      for (const [oldId, newId] of oldToNew) {
        const oldService = sourceMetro.services.find((s) => s.id === oldId);
        if (!oldService) continue;
        // Connect port-to-port and NE-to-NE across metros
        if (oldService.type === 'FABRIC_PORT' || oldService.type === 'NETWORK_EDGE') {
          const endpointType = oldService.type === 'FABRIC_PORT' ? 'PORT' as const : 'NETWORK_EDGE' as const;
          const connId = addConnection({
            name: `${metroCode}→${targetMetroCode} ${SERVICE_TYPE_LABELS[oldService.type]}`,
            type: 'EVPL_VC',
            aSide: { metroCode, type: endpointType, serviceId: oldId },
            zSide: { metroCode: targetMetroCode, type: endpointType, serviceId: newId },
            bandwidthMbps: 1000,
            redundant: false,
          });
          fetchPriceForConnection(connId, 1000);
        }
      }
    }

    setShowCopyMenu(false);
  };

  const renderServiceConfig = (service: ServiceSelection) => {
    const common = {
      key: service.id,
      service,
      metroCode,
      onUpdate: (config: Record<string, unknown>) => {
        updateConfig(service.id, config);
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
      case 'COLOCATION':
        return <ColocationConfig {...common} />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-bold text-sm text-equinix-navy truncate">
          {metro?.metroName} ({metroCode})
        </h3>
        {/* Copy to another metro */}
        {services.length > 0 && otherMetros.length > 0 && (
          <div className="relative flex-shrink-0 ml-2">
            <button
              onClick={() => setShowCopyMenu(!showCopyMenu)}
              className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy to...
            </button>
            {showCopyMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                <p className="px-3 py-1 text-[10px] text-gray-400 font-medium uppercase">
                  Copy services & connect via Fabric
                </p>
                {otherMetros.map((m) => (
                  <button
                    key={m.metroCode}
                    onClick={() => handleCopyTo(m.metroCode)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-equinix-gray transition-colors"
                  >
                    {m.metroCode} — {m.metroName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add service buttons */}
      <div className="flex gap-2 px-4 pb-3 flex-wrap">
        {SERVICE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => {
              const id = addService(type);
              const newService = useConfigStore.getState().project.metros
                .find((m) => m.metroCode === metroCode)
                ?.services.find((s) => s.id === id);
              if (newService) fetchPriceForService(metroCode, newService);
            }}
            className="px-2.5 py-1 text-xs font-medium bg-equinix-black text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            + {SERVICE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="space-y-3 px-4 pb-4">
        {services.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">
            No services configured. Add a service above.
          </p>
        )}
        {services.map(renderServiceConfig)}
      </div>
    </div>
  );
}
