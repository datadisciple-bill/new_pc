import { useCallback, useEffect, useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { fetchDeviceTypes } from '@/api/networkEdge';
import { fetchServiceProfiles } from '@/api/fabric';
import type { ServiceType } from '@/types/config';

export function useServices(metroCode: string) {
  const metro = useConfigStore((s) =>
    s.project.metros.find((m) => m.metroCode === metroCode)
  );
  const addService = useConfigStore((s) => s.addService);
  const removeService = useConfigStore((s) => s.removeService);
  const updateServiceConfig = useConfigStore((s) => s.updateServiceConfig);
  const { deviceTypes, serviceProfiles, deviceTypesLoaded, serviceProfilesLoaded } =
    useConfigStore((s) => s.cache);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadCaches = async () => {
      setIsLoading(true);
      try {
        if (!deviceTypesLoaded) await fetchDeviceTypes();
        if (!serviceProfilesLoaded) await fetchServiceProfiles();
      } catch {
        // Cached data optional, swallow errors
      } finally {
        setIsLoading(false);
      }
    };
    loadCaches();
  }, [deviceTypesLoaded, serviceProfilesLoaded]);

  const handleAddService = useCallback(
    (type: ServiceType) => addService(metroCode, type),
    [metroCode, addService]
  );

  const handleRemoveService = useCallback(
    (serviceId: string) => removeService(metroCode, serviceId),
    [metroCode, removeService]
  );

  const handleUpdateConfig = useCallback(
    (serviceId: string, config: Record<string, unknown>) =>
      updateServiceConfig(metroCode, serviceId, config),
    [metroCode, updateServiceConfig]
  );

  const deviceTypesForMetro = deviceTypes.filter((dt) =>
    dt.availableMetros.includes(metroCode)
  );

  return {
    services: metro?.services ?? [],
    addService: handleAddService,
    removeService: handleRemoveService,
    updateConfig: handleUpdateConfig,
    deviceTypes: deviceTypesForMetro,
    serviceProfiles,
    isLoading,
  };
}
