import type { EndpointType, ServiceType } from '@/types/config';
import type { Node } from '@xyflow/react';
import type { MetroSelection } from '@/types/config';

// --- Endpoint type mapping (shared with VirtualConnectionConfig) ---

export function endpointTypeForService(svcType: string): EndpointType {
  switch (svcType) {
    case 'CLOUD_ROUTER': return 'CLOUD_ROUTER';
    case 'NETWORK_EDGE': return 'NETWORK_EDGE';
    case 'COLOCATION': return 'COLOCATION';
    case 'NSP': return 'NSP';
    case 'CROSS_CONNECT': return 'CROSS_CONNECT';
    default: return 'PORT';
  }
}

// --- Service categories ---

const PHYSICAL_TYPES = new Set<string>(['COLOCATION', 'NSP', 'CROSS_CONNECT']);
const FABRIC_TYPES = new Set<string>(['FABRIC_PORT', 'NETWORK_EDGE', 'CLOUD_ROUTER', 'INTERNET_ACCESS']);

function isPhysical(svcType: string): boolean {
  return PHYSICAL_TYPES.has(svcType);
}

function isFabric(svcType: string): boolean {
  return FABRIC_TYPES.has(svcType);
}

// --- Classification result ---

export interface ClassifyResult {
  valid: true;
  kind: 'CROSS_CONNECT' | 'VIRTUAL_CIRCUIT' | 'DIAGRAM_LINK';
  bundled: boolean;
} | {
  valid: false;
  reason: string;
}

export interface NodeServiceInfo {
  serviceType: string; // ServiceType | 'LOCAL_SITE' | 'SERVICE_PROFILE'
  metroCode: string;
  serviceId: string;
}

// --- Classify a connection between two endpoints ---

export function classifyConnection(
  source: { serviceType: string; metroCode: string },
  target: { serviceType: string; metroCode: string },
): ClassifyResult {
  const a = source.serviceType;
  const b = target.serviceType;
  const sameMetro = source.metroCode === target.metroCode;

  // Local site → anything = diagram link ($0)
  if (a === 'LOCAL_SITE' || b === 'LOCAL_SITE') {
    return { valid: true, kind: 'DIAGRAM_LINK', bundled: false };
  }

  // Any → cloud node = Virtual Circuit
  if (a === 'SERVICE_PROFILE' || b === 'SERVICE_PROFILE') {
    return { valid: true, kind: 'VIRTUAL_CIRCUIT', bundled: false };
  }

  // Physical ↔ Physical
  if (isPhysical(a) && isPhysical(b)) {
    if (!sameMetro) {
      return { valid: false, reason: 'Cross Connects cannot span metros' };
    }
    return { valid: true, kind: 'CROSS_CONNECT', bundled: false };
  }

  // Fabric ↔ Fabric
  if (isFabric(a) && isFabric(b)) {
    return { valid: true, kind: 'VIRTUAL_CIRCUIT', bundled: false };
  }

  // Physical ↔ Fabric (mixed)
  const [phys, fab] = isPhysical(a) ? [a, b] : [b, a];

  // Physical ↔ NETWORK_EDGE → invalid
  if (fab === 'NETWORK_EDGE') {
    return {
      valid: false,
      reason: 'Network Edge devices connect via Equinix Fabric, not Cross Connect. Use a Fabric Port as an intermediary.',
    };
  }

  // Physical ↔ CLOUD_ROUTER → invalid
  if (fab === 'CLOUD_ROUTER') {
    return {
      valid: false,
      reason: 'Cloud Router connects via Equinix Fabric, not Cross Connect. Use a Fabric Port as an intermediary.',
    };
  }

  // Physical ↔ FABRIC_PORT or INTERNET_ACCESS → bundled Cross Connect
  if (fab === 'FABRIC_PORT' || fab === 'INTERNET_ACCESS') {
    if (!sameMetro) {
      return { valid: false, reason: 'Cross Connects cannot span metros' };
    }
    return { valid: true, kind: 'CROSS_CONNECT', bundled: true };
  }

  // Fallback: Virtual Circuit
  return { valid: true, kind: 'VIRTUAL_CIRCUIT', bundled: false };
}

// --- Resolve React Flow node ID to service info ---

export function getNodeServiceInfo(
  nodeId: string,
  reactFlowNodes: Node[],
  metros: MetroSelection[],
): NodeServiceInfo | null {
  // service-{uuid}
  if (nodeId.startsWith('service-')) {
    const node = reactFlowNodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const d = node.data as { serviceId?: string; serviceType?: string; metroCode?: string };
    return {
      serviceType: (d.serviceType as string) ?? '',
      metroCode: (d.metroCode as string) ?? '',
      serviceId: (d.serviceId as string) ?? '',
    };
  }

  // localsite-{uuid}
  if (nodeId.startsWith('localsite-')) {
    const siteId = nodeId.replace('localsite-', '');
    return {
      serviceType: 'LOCAL_SITE',
      metroCode: '',
      serviceId: siteId,
    };
  }

  // cloud-{name}
  if (nodeId.startsWith('cloud-')) {
    const node = reactFlowNodes.find((n) => n.id === nodeId);
    const provider = node ? (node.data as { provider?: string }).provider ?? nodeId.replace('cloud-', '') : nodeId.replace('cloud-', '');
    return {
      serviceType: 'SERVICE_PROFILE',
      metroCode: '',
      serviceId: provider,
    };
  }

  return null;
}

// --- Build a fast lookup map from nodes ---

export function buildNodeInfoMap(
  reactFlowNodes: Node[],
  metros: MetroSelection[],
): Map<string, NodeServiceInfo> {
  const map = new Map<string, NodeServiceInfo>();
  for (const node of reactFlowNodes) {
    if (node.type === 'serviceNode' || node.type === 'localSiteNode' || node.type === 'cloudNode') {
      const info = getNodeServiceInfo(node.id, reactFlowNodes, metros);
      if (info) map.set(node.id, info);
    }
  }
  return map;
}
