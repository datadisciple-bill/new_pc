import type { MetroSelection, VirtualConnection, NetworkEdgeConfig, ServiceSelection } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';
import { formatCurrency } from './priceCalculator';

const METRO_WIDTH = 480;
const COL_WIDTH = 220;
const METRO_HEADER_HEIGHT = 48;
const SERVICE_NODE_HEIGHT = 72;
const SERVICE_NODE_HEIGHT_HA = 88;
const SERVICE_GAP = 12;
const METRO_PADDING = 16;
const METRO_GAP_X = 120;
const METRO_GAP_Y = 40;
const METROS_PER_ROW = 2;

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

// Left column: Fabric Port, Internet Access. Right column: Network Edge, Cloud Router.
function isLeftColumn(type: string): boolean {
  return type === 'FABRIC_PORT' || type === 'INTERNET_ACCESS';
}

function getServiceNodeHeight(service: { type: string; config: unknown }): number {
  if (service.type === 'NETWORK_EDGE') {
    const c = service.config as NetworkEdgeConfig;
    return c.redundant ? SERVICE_NODE_HEIGHT_HA : SERVICE_NODE_HEIGHT;
  }
  return SERVICE_NODE_HEIGHT;
}

function computeColumnHeights(services: ServiceSelection[]): { left: number; right: number } {
  let left = 0;
  let right = 0;
  for (const svc of services) {
    const h = getServiceNodeHeight(svc) + SERVICE_GAP;
    if (isLeftColumn(svc.type)) {
      left += h;
    } else {
      right += h;
    }
  }
  return { left, right };
}

function computeMetroHeight(metro: MetroSelection): number {
  const { left, right } = computeColumnHeights(metro.services);
  const tallest = Math.max(left, right);
  return Math.max(METRO_HEADER_HEIGHT + METRO_PADDING * 2 + tallest, 200);
}

export function buildDiagramLayout(
  metros: MetroSelection[],
  connections: VirtualConnection[],
  showPricing = true
): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const servicePositions = new Map<string, { x: number; y: number }>();

  // Pre-compute max height per row
  const rowMaxHeights: number[] = [];
  metros.forEach((metro, metroIndex) => {
    const row = Math.floor(metroIndex / METROS_PER_ROW);
    const h = computeMetroHeight(metro);
    rowMaxHeights[row] = Math.max(rowMaxHeights[row] ?? 0, h);
  });

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

    nodes.push({
      id: `metro-${metro.metroCode}`,
      type: 'metroNode',
      position: { x: metroX, y: metroY },
      data: {
        metroCode: metro.metroCode,
        metroName: metro.metroName,
        region: metro.region,
      },
      style: { width: METRO_WIDTH, height: metroHeight },
      zIndex: 0,
    });

    // Two-column layout: left = FP+EIA, right = NE+FCR
    let leftY = METRO_HEADER_HEIGHT + METRO_PADDING;
    let rightY = METRO_HEADER_HEIGHT + METRO_PADDING;

    metro.services.forEach((service) => {
      const nodeHeight = getServiceNodeHeight(service);
      const left = isLeftColumn(service.type);
      const relX = left ? METRO_PADDING : METRO_PADDING + COL_WIDTH + METRO_PADDING;
      const relY = left ? leftY : rightY;

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
          showPricing,
        },
        parentId: `metro-${metro.metroCode}`,
        expandParent: true,
        style: { width: COL_WIDTH - METRO_PADDING, height: nodeHeight },
        zIndex: 1,
      });

      if (left) {
        leftY += nodeHeight + SERVICE_GAP;
      } else {
        rightY += nodeHeight + SERVICE_GAP;
      }
    });
  });

  // Price table nodes
  if (showPricing) {
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
  }

  // Connection edges
  connections.forEach((conn) => {
    const sourceId = `service-${conn.aSide.serviceId}`;
    const targetId = conn.zSide.type === 'SERVICE_PROFILE'
      ? `cloud-${conn.zSide.serviceProfileName?.replace(/\s+/g, '-')}`
      : `service-${conn.zSide.serviceId}`;

    // Cloud service profile node
    if (conn.zSide.type === 'SERVICE_PROFILE' && conn.zSide.serviceProfileName) {
      const existingCloud = nodes.find((n) => n.id === targetId);
      if (!existingCloud) {
        const aPos = servicePositions.get(conn.aSide.serviceId);
        const aMetroIndex = metros.findIndex((m) => m.metroCode === conn.aSide.metroCode);
        const mCol = aMetroIndex >= 0 ? aMetroIndex % METROS_PER_ROW : 0;
        const mRow = aMetroIndex >= 0 ? Math.floor(aMetroIndex / METROS_PER_ROW) : 0;
        nodes.push({
          id: targetId,
          type: 'cloudNode',
          position: {
            x: mCol * (METRO_WIDTH + METRO_GAP_X) + METRO_WIDTH + 40,
            y: aPos?.y ?? (rowYOffsets[mRow] + 60),
          },
          data: { provider: conn.zSide.serviceProfileName },
        });
      }
    }

    const isSameMetro = conn.aSide.metroCode === conn.zSide.metroCode;

    const bwLabel = conn.bandwidthMbps >= 1000
      ? `${conn.bandwidthMbps / 1000}G`
      : `${conn.bandwidthMbps}M`;

    // Build edge label: bandwidth + redundant indicator + optional price
    let edgeLabel = bwLabel;
    if (conn.redundant) {
      edgeLabel = `${bwLabel} (x2 Redundant)`;
    }
    if (showPricing && conn.pricing) {
      const mrcText = formatCurrency(conn.pricing.mrc);
      edgeLabel += `\n${mrcText}/mo`;
      if (conn.redundant) {
        edgeLabel += ` (each)`;
      }
    }

    const strokeColor = isSameMetro ? '#33A85C' : '#000000';

    // Single edge — thick stroke for redundant to indicate dual lines
    edges.push({
      id: `edge-${conn.id}`,
      source: sourceId,
      target: targetId,
      style: {
        stroke: strokeColor,
        strokeWidth: conn.redundant ? 4 : 1.5,
        strokeDasharray: conn.type === 'IP_VC' ? '8 4' : undefined,
      },
      label: edgeLabel,
      labelStyle: {
        fontSize: 9,
        fill: showPricing && conn.pricing ? '#33A85C' : (isSameMetro ? '#33A85C' : '#000000'),
        whiteSpace: 'pre',
      },
      animated: false,
    });
  });

  return { nodes, edges };
}
