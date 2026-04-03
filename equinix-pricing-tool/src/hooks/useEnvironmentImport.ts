import { useState, useRef, useCallback } from 'react';
import { useConfigStore } from '@/store/configStore';
import { fetchPorts, fetchConnections, fetchRouters, fetchMetros } from '@/api/fabric';
import { fetchDevices } from '@/api/networkEdge';
import {
  mapPortsToServices,
  mapRouterToService,
  mapDeviceToService,
  mapConnectionToVC,
  buildInventory,
} from '@/utils/environmentMapper';
import type { PortResponse, ConnectionResponse, RouterResponse, DeviceResponse, Metro } from '@/types/equinix';
import type { EnvironmentInventory, FabricPortConfig, CloudRouterConfig, NetworkEdgeConfig } from '@/types/config';

export type ImportPhase = 'idle' | 'fetching-inventory' | 'selecting' | 'importing' | 'complete' | 'error';

export type MetroProgress = 'pending' | 'importing' | 'done' | 'error';

export interface ImportProgress {
  [metroCode: string]: MetroProgress;
}

export interface ImportSummary {
  portsImported: number;
  routersImported: number;
  devicesImported: number;
  connectionsImported: number;
  warnings: string[];
}

interface RawData {
  ports: PortResponse[];
  connections: ConnectionResponse[];
  routers: RouterResponse[];
  devices: DeviceResponse[];
  metros: Metro[];
}

export function useEnvironmentImport() {
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [inventory, setInventory] = useState<EnvironmentInventory | null>(null);
  const [selectedMetros, setSelectedMetros] = useState<string[]>([]);
  const [progress, setProgress] = useState<ImportProgress>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const rawDataRef = useRef<RawData | null>(null);

  const fetchInventory = useCallback(async () => {
    setPhase('fetching-inventory');
    setErrors([]);
    setImportSummary(null);

    try {
      const [ports, connections, routers, devices, metros] = await Promise.all([
        fetchPorts(),
        fetchConnections(),
        fetchRouters(),
        fetchDevices(),
        fetchMetros(),
      ]);

      // Filter to active/provisioned resources
      const activePorts = ports.filter((p) => p.state === 'ACTIVE');
      const activeConnections = connections.filter((c) => c.state === 'ACTIVE');
      const activeRouters = routers.filter((r) => r.state === 'PROVISIONED');
      const activeDevices = devices.filter((d) => d.status === 'PROVISIONED');

      // Build metro lookup
      const metroLookup = new Map<string, Metro>();
      for (const m of metros) {
        metroLookup.set(m.code, m);
      }

      // Store raw data for later import
      rawDataRef.current = {
        ports: activePorts,
        connections: activeConnections,
        routers: activeRouters,
        devices: activeDevices,
        metros,
      };

      const inv = buildInventory(activePorts, activeConnections, activeRouters, activeDevices, metroLookup);
      setInventory(inv);

      // Pre-select all metros
      setSelectedMetros(inv.metros.map((m) => m.metroCode));
      setPhase('selecting');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching inventory';
      setErrors([message]);
      setPhase('error');
    }
  }, []);

  const toggleMetro = useCallback((metroCode: string) => {
    setSelectedMetros((prev) =>
      prev.includes(metroCode)
        ? prev.filter((c) => c !== metroCode)
        : [...prev, metroCode]
    );
  }, []);

  const selectAll = useCallback(() => {
    if (inventory) {
      setSelectedMetros(inventory.metros.map((m) => m.metroCode));
    }
  }, [inventory]);

  const deselectAll = useCallback(() => {
    setSelectedMetros([]);
  }, []);

  const importSelected = useCallback(async () => {
    if (!rawDataRef.current || selectedMetros.length === 0) return;

    setPhase('importing');
    setErrors([]);

    const { ports, connections, routers, devices, metros } = rawDataRef.current;
    const store = useConfigStore.getState();

    // Build metro lookup
    const metroLookup = new Map<string, Metro>();
    for (const m of metros) {
      metroLookup.set(m.code, m);
    }

    // Map source UUIDs to generated service IDs
    const serviceIdMap = new Map<string, string>();

    // Initialize progress
    const initialProgress: ImportProgress = {};
    for (const code of selectedMetros) {
      initialProgress[code] = 'pending';
    }
    setProgress(initialProgress);

    const summary: ImportSummary = {
      portsImported: 0,
      routersImported: 0,
      devicesImported: 0,
      connectionsImported: 0,
      warnings: [],
    };
    const importErrors: string[] = [];

    // Process each selected metro sequentially
    for (const metroCode of selectedMetros) {
      setProgress((prev) => ({ ...prev, [metroCode]: 'importing' }));

      try {
        // Ensure metro is in the project
        const metro = metroLookup.get(metroCode);
        if (metro) {
          store.addMetro(metro);
        } else {
          // Create a minimal metro object from inventory data
          const invMetro = inventory?.metros.find((m) => m.metroCode === metroCode);
          store.addMetro({
            code: metroCode,
            name: invMetro?.metroName ?? metroCode,
            region: invMetro?.region ?? 'AMER',
            connectedMetros: [],
          });
        }

        // Re-get store state after addMetro (state may have changed)
        const currentStore = useConfigStore.getState();

        // --- Ports ---
        const metroPorts = ports.filter((p) => p.location.metroCode === metroCode);
        const portServices = mapPortsToServices(metroPorts);
        for (const svc of portServices) {
          const serviceId = currentStore.addService(metroCode, svc.type);
          currentStore.updateServiceConfig(metroCode, serviceId, svc.config as Partial<FabricPortConfig>);

          // Set isExisting and sourceId on the service
          useConfigStore.setState((state) => ({
            project: {
              ...state.project,
              metros: state.project.metros.map((m) =>
                m.metroCode === metroCode
                  ? {
                      ...m,
                      services: m.services.map((s) =>
                        s.id === serviceId
                          ? { ...s, isExisting: true, sourceId: svc.sourceId }
                          : s
                      ),
                    }
                  : m
              ),
            },
          }));

          // Map source port UUID(s) to this service ID
          if (svc.sourceId) {
            serviceIdMap.set(svc.sourceId, serviceId);
          }

          // For redundant port pairs, map ALL port UUIDs in the group to the same serviceId
          const sourcePort = metroPorts.find((p) => p.uuid === svc.sourceId);
          if (sourcePort?.redundancy.enabled && sourcePort.redundancy.group) {
            const groupPorts = metroPorts.filter(
              (p) => p.redundancy.group === sourcePort.redundancy.group
            );
            for (const gp of groupPorts) {
              serviceIdMap.set(gp.uuid, serviceId);
            }
          }

          summary.portsImported++;
        }

        // --- Routers ---
        const metroRouters = routers.filter((r) => r.location.metroCode === metroCode);
        for (const router of metroRouters) {
          const svc = mapRouterToService(router);
          const serviceId = useConfigStore.getState().addService(metroCode, svc.type);
          useConfigStore.getState().updateServiceConfig(metroCode, serviceId, svc.config as Partial<CloudRouterConfig>);

          useConfigStore.setState((state) => ({
            project: {
              ...state.project,
              metros: state.project.metros.map((m) =>
                m.metroCode === metroCode
                  ? {
                      ...m,
                      services: m.services.map((s) =>
                        s.id === serviceId
                          ? { ...s, isExisting: true, sourceId: svc.sourceId }
                          : s
                      ),
                    }
                  : m
              ),
            },
          }));

          if (svc.sourceId) {
            serviceIdMap.set(svc.sourceId, serviceId);
          }
          summary.routersImported++;
        }

        // --- Devices ---
        const metroDevices = devices.filter((d) => d.metroCode === metroCode);
        for (const device of metroDevices) {
          const svc = mapDeviceToService(device);
          const serviceId = useConfigStore.getState().addService(metroCode, svc.type);
          useConfigStore.getState().updateServiceConfig(metroCode, serviceId, svc.config as Partial<NetworkEdgeConfig>);

          useConfigStore.setState((state) => ({
            project: {
              ...state.project,
              metros: state.project.metros.map((m) =>
                m.metroCode === metroCode
                  ? {
                      ...m,
                      services: m.services.map((s) =>
                        s.id === serviceId
                          ? { ...s, isExisting: true, sourceId: svc.sourceId }
                          : s
                      ),
                    }
                  : m
              ),
            },
          }));

          if (svc.sourceId) {
            serviceIdMap.set(svc.sourceId, serviceId);
          }
          summary.devicesImported++;
        }

        setProgress((prev) => ({ ...prev, [metroCode]: 'done' }));
      } catch (err) {
        const message = err instanceof Error ? err.message : `Error importing metro ${metroCode}`;
        importErrors.push(message);
        setProgress((prev) => ({ ...prev, [metroCode]: 'error' }));
      }
    }

    // After all metros: import connections
    // Only import connections where at least one side is in a selected metro
    const relevantConnections = connections.filter((conn) => {
      const aMetro = conn.aSide.accessPoint.location?.metroCode;
      const zMetro = conn.zSide.accessPoint.location?.metroCode;
      return (
        (aMetro && selectedMetros.includes(aMetro)) ||
        (zMetro && selectedMetros.includes(zMetro))
      );
    });

    for (const conn of relevantConnections) {
      try {
        const { connection, warnings } = mapConnectionToVC(conn, serviceIdMap);
        summary.warnings.push(...warnings);

        // addConnection expects Omit<VirtualConnection, 'id' | 'pricing' | 'priceTable' | 'showPriceTable'>
        const { id: _id, pricing: _pricing, priceTable: _pt, showPriceTable: _spt, ...connectionData } = connection;
        useConfigStore.getState().addConnection(connectionData);
        summary.connectionsImported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : `Error importing connection ${conn.uuid}`;
        importErrors.push(message);
        summary.warnings.push(message);
      }
    }

    setImportSummary(summary);
    setErrors(importErrors);
    setPhase(importErrors.length > 0 ? 'error' : 'complete');
  }, [selectedMetros, inventory]);

  const reset = useCallback(() => {
    setPhase('idle');
    setInventory(null);
    setSelectedMetros([]);
    setProgress({});
    setErrors([]);
    setImportSummary(null);
    rawDataRef.current = null;
  }, []);

  return {
    phase,
    inventory,
    selectedMetros,
    progress,
    errors,
    importSummary,
    fetchInventory,
    toggleMetro,
    selectAll,
    deselectAll,
    importSelected,
    reset,
  };
}
