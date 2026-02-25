import type { MetroSelection, VirtualConnection, NetworkEdgeConfig, ServiceSelection, TextBox } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';
import { formatCurrency } from './priceCalculator';

export const COL_WIDTH = 220;
const SERVICE_NODE_WIDTH = COL_WIDTH - 16;
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

// Left column: Fabric Port, Internet Access, Colocation, NSP. Right column: Network Edge, Cloud Router.
function isLeftColumn(type: string): boolean {
  return type === 'FABRIC_PORT' || type === 'INTERNET_ACCESS' || type === 'COLOCATION' || type === 'NSP';
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
  if (left > 0) left -= SERVICE_GAP;
  if (right > 0) right -= SERVICE_GAP;
  return { left, right };
}

function computeMetroWidth(metro: MetroSelection): number {
  const hasLeft = metro.services.some((s) => isLeftColumn(s.type));
  const hasRight = metro.services.some((s) => !isLeftColumn(s.type));
  if (hasLeft && hasRight) {
    return METRO_PADDING + COL_WIDTH + METRO_PADDING + COL_WIDTH + METRO_PADDING;
  }
  // Single column or empty
  return METRO_PADDING + COL_WIDTH + METRO_PADDING;
}

function computeMetroHeight(metro: MetroSelection): number {
  const { left, right } = computeColumnHeights(metro.services);
  const tallest = Math.max(left, right);
  return METRO_HEADER_HEIGHT + METRO_PADDING + (tallest > 0 ? tallest + METRO_PADDING : METRO_PADDING);
}

export function buildDiagramLayout(
  metros: MetroSelection[],
  connections: VirtualConnection[],
  showPricing = true,
  textBoxes: TextBox[] = []
): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const servicePositions = new Map<string, { x: number; y: number }>();

  // Per-metro widths
  const metroWidths = metros.map(computeMetroWidth);

  // Per grid-column max widths
  const colMaxWidths: number[] = [];
  metros.forEach((_, i) => {
    const col = i % METROS_PER_ROW;
    colMaxWidths[col] = Math.max(colMaxWidths[col] ?? 0, metroWidths[i]);
  });

  // Column X offsets (based on max width in each grid column)
  const colXOffsets: number[] = [];
  let cumX = 0;
  for (let c = 0; c <= Math.min(metros.length - 1, METROS_PER_ROW - 1); c++) {
    colXOffsets[c] = cumX;
    cumX += (colMaxWidths[c] ?? 0) + METRO_GAP_X;
  }

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

    const metroWidth = metroWidths[metroIndex];
    const metroHeight = computeMetroHeight(metro);
    const metroX = colXOffsets[col] ?? 0;
    const metroY = rowYOffsets[row];

    const hasLeft = metro.services.some((s) => isLeftColumn(s.type));
    const hasRight = metro.services.some((s) => !isLeftColumn(s.type));
    const isSingleColumn = !(hasLeft && hasRight);

    nodes.push({
      id: `metro-${metro.metroCode}`,
      type: 'metroNode',
      position: { x: metroX, y: metroY },
      data: {
        metroCode: metro.metroCode,
        metroName: metro.metroName,
        region: metro.region,
      },
      style: { width: metroWidth, height: metroHeight },
      width: metroWidth,
      height: metroHeight,
      zIndex: 0,
    });

    let leftY = METRO_HEADER_HEIGHT + METRO_PADDING;
    let rightY = METRO_HEADER_HEIGHT + METRO_PADDING;

    metro.services.forEach((service) => {
      const nodeHeight = getServiceNodeHeight(service);
      const left = isLeftColumn(service.type);

      // If single column, all services in first column position
      let relX: number;
      if (isSingleColumn) {
        relX = METRO_PADDING;
      } else {
        relX = left ? METRO_PADDING : METRO_PADDING + COL_WIDTH + METRO_PADDING;
      }
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
        style: { width: SERVICE_NODE_WIDTH, height: nodeHeight },
        width: SERVICE_NODE_WIDTH,
        height: nodeHeight,
        zIndex: 2,
      });

      if (left) {
        leftY += nodeHeight + SERVICE_GAP;
      } else {
        rightY += nodeHeight + SERVICE_GAP;
      }
    });
  });

  // Price tables: positioned below the metro grid so they don't overlap metro containers
  const PT_GAP = 16;
  let ptX = 0;
  let ptY = cumulativeY + 20; // below all metro rows
  let ptRowMaxH = 0;
  const ptRowMaxWidth = Math.max(cumX, 600); // wrap within metro grid width

  // VC price table nodes
  if (showPricing) {
    connections.forEach((conn) => {
      if (conn.showPriceTable && conn.priceTable && conn.priceTable.length > 0) {
        const rowHeight = 14;
        const tableHeight = 28 + conn.priceTable.length * rowHeight;
        const tableWidth = 200;
        if (ptX > 0 && ptX + tableWidth > ptRowMaxWidth) {
          ptX = 0;
          ptY += ptRowMaxH + PT_GAP;
          ptRowMaxH = 0;
        }
        nodes.push({
          id: `pricetable-${conn.id}`,
          type: 'priceTableNode',
          position: { x: ptX, y: ptY },
          data: {
            connectionName: conn.name || conn.type,
            selectedBandwidthMbps: conn.bandwidthMbps,
            priceTable: conn.priceTable,
          },
          style: { width: tableWidth, height: tableHeight },
          width: tableWidth,
          height: tableHeight,
          draggable: true,
          zIndex: 10,
        });
        ptX += tableWidth + PT_GAP;
        ptRowMaxH = Math.max(ptRowMaxH, tableHeight);
      }
    });

    // NE price table nodes
    metros.forEach((metro) => {
      metro.services.forEach((service) => {
        if (service.type === 'NETWORK_EDGE') {
          const neConfig = service.config as NetworkEdgeConfig;
          if (neConfig.showPriceTable && neConfig.priceTable && neConfig.priceTable.length > 0) {
            const rowHeight = 14;
            const discountBanner = (neConfig.termLength ?? 1) > 1 ? 16 : 0;
            const tableHeight = 28 + discountBanner + neConfig.priceTable.length * rowHeight;
            const tableWidth = 220;
            if (ptX > 0 && ptX + tableWidth > ptRowMaxWidth) {
              ptX = 0;
              ptY += ptRowMaxH + PT_GAP;
              ptRowMaxH = 0;
            }
            nodes.push({
              id: `nepricetable-${service.id}`,
              type: 'nePriceTableNode',
              position: { x: ptX, y: ptY },
              data: {
                serviceName: `${neConfig.deviceTypeName || 'Network Edge'} (${metro.metroCode})`,
                selectedCores: neConfig.packageCode,
                priceTable: neConfig.priceTable,
                termLength: neConfig.termLength,
              },
              style: { width: tableWidth, height: tableHeight },
              width: tableWidth,
              height: tableHeight,
              draggable: true,
              zIndex: 10,
            });
            ptX += tableWidth + PT_GAP;
            ptRowMaxH = Math.max(ptRowMaxH, tableHeight);
          }
        }
      });
    });
  }

  // Text box nodes
  textBoxes.forEach((tb) => {
    nodes.push({
      id: `textbox-${tb.id}`,
      type: 'textBoxNode',
      position: { x: tb.x, y: tb.y },
      data: { textBoxId: tb.id, text: tb.text, tbWidth: tb.width, tbHeight: tb.height },
      style: { width: tb.width, height: tb.height },
      width: tb.width,
      height: tb.height,
      draggable: true,
      zIndex: 4,
    });
  });

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
        const mWidth = aMetroIndex >= 0 ? metroWidths[aMetroIndex] : 480;
        nodes.push({
          id: targetId,
          type: 'cloudNode',
          position: {
            x: (colXOffsets[mCol] ?? 0) + mWidth + 40,
            y: aPos?.y ?? (rowYOffsets[mRow] + 60),
          },
          data: { provider: conn.zSide.serviceProfileName },
          zIndex: 2,
        });
      }
    }

    const isSameMetro = conn.aSide.metroCode === conn.zSide.metroCode;

    const bwLabel = conn.bandwidthMbps >= 1000
      ? `${conn.bandwidthMbps / 1000}G`
      : `${conn.bandwidthMbps}M`;

    let labelLine1 = bwLabel;
    if (conn.redundant) labelLine1 += ' ×2';

    let labelLine2 = '';
    if (showPricing && conn.pricing) {
      labelLine2 = formatCurrency(conn.pricing.mrc) + '/mo';
      if (conn.redundant) labelLine2 += ' ea.';
    }

    const strokeColor = isSameMetro ? '#33A85C' : '#000000';

    edges.push({
      id: `edge-${conn.id}`,
      source: sourceId,
      target: targetId,
      type: 'customEdge',
      style: {
        stroke: strokeColor,
        strokeWidth: conn.redundant ? 4 : 1.5,
        strokeDasharray: conn.type === 'IP_VC' ? '8 4' : undefined,
      },
      data: {
        labelLine1,
        labelLine2,
        showPricing,
        isSameMetro,
      },
      zIndex: 5,
    });
  });

  return { nodes, edges };
}
