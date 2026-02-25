import type { MetroSelection, VirtualConnection, NetworkEdgeConfig } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';

const METRO_WIDTH = 280;
const METRO_HEADER_HEIGHT = 48;
const SERVICE_NODE_HEIGHT = 72;
const SERVICE_NODE_HEIGHT_HA = 88;
const SERVICE_GAP = 12;
const METRO_PADDING = 16;
const METRO_GAP_X = 100;
const METRO_GAP_Y = 40;
const METROS_PER_ROW = 3;

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

function getServiceNodeHeight(service: { type: string; config: unknown }): number {
  if (service.type === 'NETWORK_EDGE') {
    const c = service.config as NetworkEdgeConfig;
    return c.redundant ? SERVICE_NODE_HEIGHT_HA : SERVICE_NODE_HEIGHT;
  }
  return SERVICE_NODE_HEIGHT;
}

function computeMetroHeight(metro: MetroSelection): number {
  let totalServiceHeight = 0;
  for (const svc of metro.services) {
    totalServiceHeight += getServiceNodeHeight(svc) + SERVICE_GAP;
  }
  return Math.max(METRO_HEADER_HEIGHT + METRO_PADDING * 2 + totalServiceHeight, 200);
}

export function buildDiagramLayout(
  metros: MetroSelection[],
  connections: VirtualConnection[]
): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Track absolute positions for services so we can route edges
  const servicePositions = new Map<string, { x: number; y: number }>();

  // Pre-compute the max height per row so rows don't overlap
  const rowMaxHeights: number[] = [];
  metros.forEach((metro, metroIndex) => {
    const row = Math.floor(metroIndex / METROS_PER_ROW);
    const h = computeMetroHeight(metro);
    rowMaxHeights[row] = Math.max(rowMaxHeights[row] ?? 0, h);
  });

  // Cumulative Y offsets per row
  const rowYOffsets: number[] = [];
  let cumulativeY = 0;
  for (let r = 0; r < rowMaxHeights.length; r++) {
    rowYOffsets[r] = cumulativeY;
    cumulativeY += rowMaxHeights[r] + METRO_GAP_Y;
  }

  metros.forEach((metro, metroIndex) => {
    const col = metroIndex % METROS_PER_ROW;
    const row = Math.floor(metroIndex / METROS_PER_ROW);

    const metroHeight = computeMetroHeight(metro);
    const metroX = col * (METRO_WIDTH + METRO_GAP_X);
    const metroY = rowYOffsets[row];

    // Metro container node — z-index 0 so services render on top
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
        height: metroHeight,
      },
      zIndex: 0,
    });

    // Service nodes positioned within the metro container
    let yOffset = METRO_HEADER_HEIGHT + METRO_PADDING;
    metro.services.forEach((service) => {
      const nodeHeight = getServiceNodeHeight(service);
      const relX = METRO_PADDING;
      const relY = yOffset;

      // Store absolute position for edge routing
      servicePositions.set(service.id, {
        x: metroX + relX,
        y: metroY + relY,
      });

      nodes.push({
        id: `service-${service.id}`,
        type: 'serviceNode',
        position: { x: relX, y: relY },
        data: {
          serviceId: service.id,
          serviceType: service.type,
          config: service.config,
          pricing: service.pricing,
        },
        parentId: `metro-${metro.metroCode}`,
        expandParent: true,
        style: {
          width: METRO_WIDTH - METRO_PADDING * 2,
          height: nodeHeight,
        },
        zIndex: 1,
      });

      yOffset += nodeHeight + SERVICE_GAP;
    });
  });

  // Price table nodes — positioned to the right of the rightmost metro column
  const maxCol = Math.min(metros.length, METROS_PER_ROW) - 1;
  const priceTableX = (maxCol + 1) * (METRO_WIDTH + METRO_GAP_X) + 40;
  let priceTableY = 0;

  connections.forEach((conn) => {
    if (conn.showPriceTable && conn.priceTable && conn.priceTable.length > 0) {
      const rowHeight = 14;
      const tableHeight = 28 + conn.priceTable.length * rowHeight;
      nodes.push({
        id: `pricetable-${conn.id}`,
        type: 'priceTableNode',
        position: { x: priceTableX, y: priceTableY },
        data: {
          connectionName: conn.name || conn.type,
          selectedBandwidthMbps: conn.bandwidthMbps,
          priceTable: conn.priceTable,
        },
        style: { width: 180, height: tableHeight },
      });
      priceTableY += tableHeight + 16;
    }
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
        const aPos = servicePositions.get(conn.aSide.serviceId);
        const aMetroIndex = metros.findIndex((m) => m.metroCode === conn.aSide.metroCode);
        const col = aMetroIndex >= 0 ? aMetroIndex % METROS_PER_ROW : 0;
        const row = aMetroIndex >= 0 ? Math.floor(aMetroIndex / METROS_PER_ROW) : 0;
        nodes.push({
          id: targetId,
          type: 'cloudNode',
          position: {
            x: col * (METRO_WIDTH + METRO_GAP_X) + METRO_WIDTH + 40,
            y: aPos?.y ?? (rowYOffsets[row] + 60),
          },
          data: {
            provider: conn.zSide.serviceProfileName,
          },
        });
      }
    }

    // Determine if this is an intra-metro connection
    const isSameMetro = conn.aSide.metroCode === conn.zSide.metroCode;

    const bwLabel = conn.bandwidthMbps >= 1000
      ? `${conn.bandwidthMbps / 1000}G`
      : `${conn.bandwidthMbps}M`;

    edges.push({
      id: `edge-${conn.id}`,
      source: sourceId,
      target: targetId,
      style: {
        stroke: isSameMetro ? '#33A85C' : '#000000',
        strokeWidth: conn.redundant ? 3 : 1.5,
        strokeDasharray: conn.type === 'IP_VC' ? '8 4' : undefined,
      },
      label: bwLabel,
      labelStyle: { fontSize: 9, fill: isSameMetro ? '#33A85C' : '#000000' },
      animated: false,
    });

    if (conn.redundant) {
      edges.push({
        id: `edge-${conn.id}-redundant`,
        source: sourceId,
        target: targetId,
        style: {
          stroke: isSameMetro ? '#33A85C' : '#000000',
          strokeWidth: 1.5,
          strokeDasharray: conn.type === 'IP_VC' ? '8 4' : undefined,
        },
        animated: false,
      });
    }
  });

  return { nodes, edges };
}
