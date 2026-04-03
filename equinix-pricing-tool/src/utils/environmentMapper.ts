import { v4 as uuidv4 } from 'uuid';
import type {
  PortResponse,
  ConnectionResponse,
  RouterResponse,
  DeviceResponse,
  Metro,
} from '@/types/equinix';
import type {
  ServiceSelection,
  FabricPortConfig,
  CloudRouterConfig,
  NetworkEdgeConfig,
  VirtualConnection,
  ConnectionEndpoint,
  EnvironmentInventory,
  EnvironmentInventoryMetro,
  PortSpeed,
} from '@/types/config';

function speedMbpsToLabel(mbps: number): PortSpeed {
  if (mbps >= 400000) return '400G';
  if (mbps >= 100000) return '100G';
  if (mbps >= 10000) return '10G';
  return '1G';
}

/**
 * Maps raw API ports to ServiceSelection objects.
 * Groups redundant port pairs (same redundancy.group) into a single REDUNDANT service.
 */
export function mapPortsToServices(ports: PortResponse[]): ServiceSelection[] {
  const services: ServiceSelection[] = [];
  const processedGroups = new Set<string>();

  for (const port of ports) {
    if (port.redundancy.enabled && port.redundancy.group) {
      if (processedGroups.has(port.redundancy.group)) continue;
      processedGroups.add(port.redundancy.group);
    }

    const isRedundant = port.redundancy.enabled && port.redundancy.group !== '';
    const config: FabricPortConfig = {
      speed: speedMbpsToLabel(port.physicalPortSpeed),
      portProduct: 'STANDARD',
      type: isRedundant ? 'REDUNDANT' : 'PRIMARY',
      encapsulation: port.encapsulation.type,
      quantity: 1,
    };

    services.push({
      id: uuidv4(),
      type: 'FABRIC_PORT',
      config,
      pricing: null,
      isExisting: true,
      sourceId: port.uuid,
    });
  }

  return services;
}

export function mapRouterToService(router: RouterResponse): ServiceSelection {
  const config: CloudRouterConfig = {
    package: router.package.code,
  };

  return {
    id: uuidv4(),
    type: 'CLOUD_ROUTER',
    config,
    pricing: null,
    isExisting: true,
    sourceId: router.uuid,
  };
}

export function mapDeviceToService(device: DeviceResponse): ServiceSelection {
  const config: NetworkEdgeConfig = {
    deviceTypeCode: device.deviceTypeCode,
    deviceTypeName: device.name,
    vendorName: device.vendorName,
    packageCode: device.packageCode,
    coreMemory: `${device.coreCount} Cores`,
    softwareVersion: device.softwareVersion,
    licenseType: device.licenseType === 'BYOL' ? 'BYOL' : 'SUBSCRIPTION',
    redundant: device.redundant,
    termLength: device.termLength as 1 | 12 | 24 | 36,
  };

  return {
    id: uuidv4(),
    type: 'NETWORK_EDGE',
    config,
    pricing: null,
    isExisting: true,
    sourceId: device.uuid,
  };
}

function resolveEndpoint(
  accessPoint: ConnectionResponse['aSide']['accessPoint'],
  serviceIdMap: Map<string, string>
): ConnectionEndpoint {
  const metroCode = accessPoint.location?.metroCode ?? '';

  if (accessPoint.port?.uuid) {
    const serviceId = serviceIdMap.get(accessPoint.port.uuid) ?? '';
    return { metroCode, type: 'PORT', serviceId };
  }
  if (accessPoint.router?.uuid) {
    const serviceId = serviceIdMap.get(accessPoint.router.uuid) ?? '';
    return { metroCode, type: 'CLOUD_ROUTER', serviceId };
  }
  if (accessPoint.profile?.uuid) {
    return { metroCode, type: 'SERVICE_PROFILE', serviceId: '', serviceProfileName: accessPoint.profile.uuid };
  }

  return { metroCode, type: 'PORT', serviceId: '' };
}

export interface ConnectionMapResult {
  connection: VirtualConnection;
  warnings: string[];
}

export function mapConnectionToVC(
  conn: ConnectionResponse,
  serviceIdMap: Map<string, string>
): ConnectionMapResult {
  const warnings: string[] = [];
  const aSide = resolveEndpoint(conn.aSide.accessPoint, serviceIdMap);
  const zSide = resolveEndpoint(conn.zSide.accessPoint, serviceIdMap);

  if (aSide.serviceId === '') {
    warnings.push(`A-side endpoint references unimported resource (${conn.aSide.accessPoint.port?.uuid ?? conn.aSide.accessPoint.router?.uuid ?? conn.aSide.accessPoint.profile?.uuid ?? 'unknown'})`);
  }
  if (zSide.serviceId === '') {
    warnings.push(`Z-side endpoint references unimported resource (${conn.zSide.accessPoint.port?.uuid ?? conn.zSide.accessPoint.router?.uuid ?? conn.zSide.accessPoint.profile?.uuid ?? 'unknown'})`);
  }

  const connection: VirtualConnection = {
    id: uuidv4(),
    name: conn.name,
    type: conn.type,
    aSide,
    zSide,
    bandwidthMbps: conn.bandwidth,
    redundant: conn.redundancy != null,
    pricing: null,
    showPriceTable: false,
    priceTable: null,
    isExisting: true,
    sourceId: conn.uuid,
  };

  return { connection, warnings };
}

export function buildInventory(
  ports: PortResponse[],
  connections: ConnectionResponse[],
  routers: RouterResponse[],
  devices: DeviceResponse[],
  metroLookup: Map<string, Metro>
): EnvironmentInventory {
  const metroMap = new Map<string, EnvironmentInventoryMetro>();

  function getOrCreateMetro(code: string, name: string): EnvironmentInventoryMetro {
    if (!metroMap.has(code)) {
      const metro = metroLookup.get(code);
      metroMap.set(code, {
        metroCode: code,
        metroName: name || metro?.name || code,
        region: (metro?.region ?? 'AMER') as 'AMER' | 'EMEA' | 'APAC',
        portCount: 0,
        connectionCount: 0,
        routerCount: 0,
        deviceCount: 0,
      });
    }
    return metroMap.get(code)!;
  }

  for (const port of ports) {
    getOrCreateMetro(port.location.metroCode, port.location.metroName).portCount++;
  }
  for (const conn of connections) {
    const aMetro = conn.aSide.accessPoint.location?.metroCode;
    const zMetro = conn.zSide.accessPoint.location?.metroCode;
    if (aMetro) getOrCreateMetro(aMetro, '').connectionCount++;
    if (zMetro && zMetro !== aMetro) getOrCreateMetro(zMetro, '').connectionCount++;
  }
  for (const router of routers) {
    getOrCreateMetro(router.location.metroCode, router.location.metroName).routerCount++;
  }
  for (const device of devices) {
    getOrCreateMetro(device.metroCode, '').deviceCount++;
  }

  const metros = Array.from(metroMap.values()).sort((a, b) => a.metroCode.localeCompare(b.metroCode));

  return {
    metros,
    totalPorts: ports.length,
    totalConnections: connections.length,
    totalRouters: routers.length,
    totalDevices: devices.length,
  };
}
