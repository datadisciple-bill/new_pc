import type { MetroSelection, VirtualConnection } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';

const METRO_WIDTH = 280;
const METRO_HEADER_HEIGHT = 48;
const SERVICE_NODE_HEIGHT = 72;
const SERVICE_GAP = 12;
const METRO_PADDING = 16;
const METRO_GAP_X = 80;
const METRO_GAP_Y = 40;
const METROS_PER_ROW = 3;

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function buildDiagramLayout(
  metros: MetroSelection[],
  connections: VirtualConnection[]
): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  metros.forEach((metro, metroIndex) => {
    const col = metroIndex % METROS_PER_ROW;
    const row = Math.floor(metroIndex / METROS_PER_ROW);

    const serviceCount = metro.services.length;
    const metroHeight = METRO_HEADER_HEIGHT + METRO_PADDING * 2 +
      serviceCount * (SERVICE_NODE_HEIGHT + SERVICE_GAP);

    const metroX = col * (METRO_WIDTH + METRO_GAP_X);
    const metroY = row * (400 + METRO_GAP_Y);

    // Metro container node
    nodes.push({
      id: `metro-${metro.metroCode}`,
      type: 'metroNode',
      position: { x: metroX, y: metroY },
      data: {
        metroCode: metro.metroCode,
        metroName: metro.metroName,
        region: metro.region,
      },
      style: {
        width: METRO_WIDTH,
        height: Math.max(metroHeight, 200),
      },
    });

    // Service nodes inside metro
    metro.services.forEach((service, serviceIndex) => {
      const serviceX = metroX + METRO_PADDING;
      const serviceY = metroY + METRO_HEADER_HEIGHT + METRO_PADDING +
        serviceIndex * (SERVICE_NODE_HEIGHT + SERVICE_GAP);

      nodes.push({
        id: `service-${service.id}`,
        type: 'serviceNode',
        position: { x: serviceX, y: serviceY },
        data: {
          serviceId: service.id,
          serviceType: service.type,
          config: service.config,
          pricing: service.pricing,
        },
        parentId: `metro-${metro.metroCode}`,
        extent: 'parent' as const,
        style: {
          width: METRO_WIDTH - METRO_PADDING * 2,
          height: SERVICE_NODE_HEIGHT,
        },
      });
    });
  });

  // Connection edges
  connections.forEach((conn) => {
    const sourceId = `service-${conn.aSide.serviceId}`;
    const targetId = conn.zSide.type === 'SERVICE_PROFILE'
      ? `cloud-${conn.zSide.serviceProfileName?.replace(/\s+/g, '-')}`
      : `service-${conn.zSide.serviceId}`;

    // If target is a cloud service profile, add a cloud node
    if (conn.zSide.type === 'SERVICE_PROFILE' && conn.zSide.serviceProfileName) {
      const existingCloud = nodes.find((n) => n.id === targetId);
      if (!existingCloud) {
        const zMetroIndex = metros.findIndex((m) => m.metroCode === conn.zSide.metroCode);
        const col = zMetroIndex >= 0 ? zMetroIndex % METROS_PER_ROW : metros.length % METROS_PER_ROW;
        const row = zMetroIndex >= 0 ? Math.floor(zMetroIndex / METROS_PER_ROW) : 0;
        nodes.push({
          id: targetId,
          type: 'cloudNode',
          position: {
            x: col * (METRO_WIDTH + METRO_GAP_X) + METRO_WIDTH + 40,
            y: row * (400 + METRO_GAP_Y) + 60,
          },
          data: {
            provider: conn.zSide.serviceProfileName,
          },
        });
      }
    }

    edges.push({
      id: `edge-${conn.id}`,
      source: sourceId,
      target: targetId,
      type: conn.type === 'EVPL_VC' ? 'default' : 'default',
      style: {
        stroke: '#000000',
        strokeWidth: conn.redundant ? 3 : 1.5,
        strokeDasharray: conn.type === 'IP_VC' ? '8 4' : undefined,
      },
      label: `${conn.bandwidthMbps >= 1000 ? `${conn.bandwidthMbps / 1000}G` : `${conn.bandwidthMbps}M`}`,
      animated: false,
    });

    if (conn.redundant) {
      edges.push({
        id: `edge-${conn.id}-redundant`,
        source: sourceId,
        target: targetId,
        style: {
          stroke: '#000000',
          strokeWidth: 1.5,
          strokeDasharray: conn.type === 'IP_VC' ? '8 4' : undefined,
        },
        animated: false,
      });
    }
  });

  return { nodes, edges };
}
