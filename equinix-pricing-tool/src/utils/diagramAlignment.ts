import type { Node } from '@xyflow/react';
import type { MetroSelection, VirtualConnection } from '@/types/config';

/** Gap between metros in various layouts */
const METRO_GAP = 60;
/** Gap between region groups */
const REGION_GAP = 120;

interface MetroInfo {
  node: Node;
  metro: MetroSelection;
  width: number;
  height: number;
  children: Node[];
}

/** Extract metro node info from the full node list */
function getMetroInfos(nodes: Node[], metros: MetroSelection[]): MetroInfo[] {
  return metros.map((metro) => {
    const node = nodes.find((n) => n.id === `metro-${metro.metroCode}`);
    if (!node) return null;
    const children = nodes.filter((n) => n.parentId === node.id);
    return {
      node,
      metro,
      width: node.width ?? (node.style?.width as number) ?? 252,
      height: node.height ?? (node.style?.height as number) ?? 120,
      children,
    };
  }).filter(Boolean) as MetroInfo[];
}

/** Get all non-metro, non-child floating nodes */
function getFloatingNodes(nodes: Node[]): Node[] {
  return nodes.filter(
    (n) => n.type !== 'metroNode' && !n.parentId
  );
}

/**
 * Apply new metro positions and shift floating nodes by the same delta as the
 * overall bounding box shift. Returns a new full node array.
 */
function applyMetroPositions(
  nodes: Node[],
  metroInfos: MetroInfo[],
  newPositions: Map<string, { x: number; y: number }>,
): Node[] {
  // Compute bounding box shift for floating nodes
  let oldMinX = Infinity, oldMinY = Infinity;
  let newMinX = Infinity, newMinY = Infinity;
  for (const info of metroInfos) {
    oldMinX = Math.min(oldMinX, info.node.position.x);
    oldMinY = Math.min(oldMinY, info.node.position.y);
    const np = newPositions.get(info.node.id);
    if (np) {
      newMinX = Math.min(newMinX, np.x);
      newMinY = Math.min(newMinY, np.y);
    }
  }
  const dx = isFinite(newMinX) && isFinite(oldMinX) ? newMinX - oldMinX : 0;
  const dy = isFinite(newMinY) && isFinite(oldMinY) ? newMinY - oldMinY : 0;

  return nodes.map((node) => {
    const newPos = newPositions.get(node.id);
    if (newPos) {
      return { ...node, position: newPos };
    }
    // Shift floating nodes proportionally
    if (node.type !== 'metroNode' && !node.parentId && (dx || dy)) {
      return {
        ...node,
        position: { x: node.position.x + dx, y: node.position.y + dy },
      };
    }
    return node;
  });
}

/** Stack Vertical: metros arranged top to bottom in a single column */
export function alignVertical(nodes: Node[], metros: MetroSelection[]): Node[] {
  const infos = getMetroInfos(nodes, metros);
  const positions = new Map<string, { x: number; y: number }>();
  let y = 0;
  // Center all metros horizontally around the widest one
  const maxW = Math.max(...infos.map((i) => i.width));
  for (const info of infos) {
    positions.set(info.node.id, { x: (maxW - info.width) / 2, y });
    y += info.height + METRO_GAP;
  }
  return applyMetroPositions(nodes, infos, positions);
}

/** Distribute Even Spacing: keep order, equalize horizontal & vertical gaps */
export function alignDistributeEven(nodes: Node[], metros: MetroSelection[]): Node[] {
  const infos = getMetroInfos(nodes, metros);
  if (infos.length <= 1) return nodes;

  const positions = new Map<string, { x: number; y: number }>();

  // Detect if current layout is more horizontal or vertical
  const sorted = [...infos].sort((a, b) => a.node.position.x - b.node.position.x || a.node.position.y - b.node.position.y);

  // Get bounding box
  let minX = Infinity, maxRight = -Infinity;
  let minY = Infinity, maxBottom = -Infinity;
  for (const info of sorted) {
    minX = Math.min(minX, info.node.position.x);
    maxRight = Math.max(maxRight, info.node.position.x + info.width);
    minY = Math.min(minY, info.node.position.y);
    maxBottom = Math.max(maxBottom, info.node.position.y + info.height);
  }

  const totalW = sorted.reduce((s, i) => s + i.width, 0);
  const totalH = sorted.reduce((s, i) => s + i.height, 0);
  const spanX = maxRight - minX;
  const spanY = maxBottom - minY;

  if (spanX >= spanY) {
    // Horizontal distribution
    const gap = (spanX - totalW) / Math.max(sorted.length - 1, 1);
    const evenGap = Math.max(gap, METRO_GAP);
    let x = minX;
    for (const info of sorted) {
      positions.set(info.node.id, { x, y: minY });
      x += info.width + evenGap;
    }
  } else {
    // Vertical distribution
    const gap = (spanY - totalH) / Math.max(sorted.length - 1, 1);
    const evenGap = Math.max(gap, METRO_GAP);
    let y = minY;
    for (const info of sorted) {
      positions.set(info.node.id, { x: minX, y });
      y += info.height + evenGap;
    }
  }

  return applyMetroPositions(nodes, infos, positions);
}

/** Compact: minimize whitespace, tight packing */
export function alignCompact(nodes: Node[], metros: MetroSelection[]): Node[] {
  const infos = getMetroInfos(nodes, metros);
  const positions = new Map<string, { x: number; y: number }>();
  const gap = 24;

  // Pack in rows, wrapping when width exceeds a reasonable limit
  const maxRowWidth = Math.max(
    ...infos.map((i) => i.width * 2 + gap),
    800,
  );

  let x = 0;
  let y = 0;
  let rowMaxH = 0;

  for (const info of infos) {
    if (x > 0 && x + info.width > maxRowWidth) {
      x = 0;
      y += rowMaxH + gap;
      rowMaxH = 0;
    }
    positions.set(info.node.id, { x, y });
    x += info.width + gap;
    rowMaxH = Math.max(rowMaxH, info.height);
  }

  return applyMetroPositions(nodes, infos, positions);
}

/** Center on Canvas: shift all nodes so the bounding box is centered at origin */
export function alignCenter(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Get bounding box of all top-level nodes (not children)
  const topLevel = nodes.filter((n) => !n.parentId);
  if (topLevel.length === 0) return nodes;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const n of topLevel) {
    const w = n.width ?? (n.style?.width as number) ?? 200;
    const h = n.height ?? (n.style?.height as number) ?? 80;
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x + w);
    minY = Math.min(minY, n.position.y);
    maxY = Math.max(maxY, n.position.y + h);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return nodes.map((n) => {
    if (n.parentId) return n; // children are relative to parent
    return {
      ...n,
      position: {
        x: n.position.x - centerX,
        y: n.position.y - centerY,
      },
    };
  });
}

/** Align Metros Top: snap all metros to a shared top Y baseline */
export function alignMetrosTop(nodes: Node[], metros: MetroSelection[]): Node[] {
  const infos = getMetroInfos(nodes, metros);
  if (infos.length === 0) return nodes;

  const minY = Math.min(...infos.map((i) => i.node.position.y));
  const positions = new Map<string, { x: number; y: number }>();
  for (const info of infos) {
    positions.set(info.node.id, { x: info.node.position.x, y: minY });
  }
  return applyMetroPositions(nodes, infos, positions);
}

/** Align Metros Bottom: snap all metros to a shared bottom Y baseline */
export function alignMetrosBottom(nodes: Node[], metros: MetroSelection[]): Node[] {
  const infos = getMetroInfos(nodes, metros);
  if (infos.length === 0) return nodes;

  const maxBottom = Math.max(...infos.map((i) => i.node.position.y + i.height));
  const positions = new Map<string, { x: number; y: number }>();
  for (const info of infos) {
    positions.set(info.node.id, { x: info.node.position.x, y: maxBottom - info.height });
  }
  return applyMetroPositions(nodes, infos, positions);
}

/**
 * Hub-and-Spoke: the metro with the most connections goes to center,
 * others radiate outward in a circle.
 */
export function alignHubAndSpoke(
  nodes: Node[],
  metros: MetroSelection[],
  connections: VirtualConnection[],
): Node[] {
  const infos = getMetroInfos(nodes, metros);
  if (infos.length <= 1) return nodes;

  // Count connections per metro
  const connCount = new Map<string, number>();
  for (const info of infos) connCount.set(info.metro.metroCode, 0);
  for (const conn of connections) {
    connCount.set(conn.aSide.metroCode, (connCount.get(conn.aSide.metroCode) ?? 0) + 1);
    connCount.set(conn.zSide.metroCode, (connCount.get(conn.zSide.metroCode) ?? 0) + 1);
  }

  // Hub = most connected metro
  const sorted = [...infos].sort(
    (a, b) => (connCount.get(b.metro.metroCode) ?? 0) - (connCount.get(a.metro.metroCode) ?? 0)
  );
  const hub = sorted[0];
  const spokes = sorted.slice(1);

  const positions = new Map<string, { x: number; y: number }>();

  // Place hub at center
  positions.set(hub.node.id, { x: -hub.width / 2, y: -hub.height / 2 });

  // Place spokes in a circle
  const radius = Math.max(hub.width, hub.height) + 160;
  spokes.forEach((spoke, i) => {
    const angle = (2 * Math.PI * i) / spokes.length - Math.PI / 2;
    positions.set(spoke.node.id, {
      x: Math.cos(angle) * radius - spoke.width / 2,
      y: Math.sin(angle) * radius - spoke.height / 2,
    });
  });

  return applyMetroPositions(nodes, infos, positions);
}

/**
 * Group by Region: cluster AMER/EMEA/APAC metros into spatial groups
 * arranged left-to-right with region labels.
 */
export function alignByRegion(nodes: Node[], metros: MetroSelection[]): Node[] {
  const infos = getMetroInfos(nodes, metros);
  if (infos.length === 0) return nodes;

  // Group by region
  const regionOrder = ['AMER', 'EMEA', 'APAC'];
  const groups = new Map<string, MetroInfo[]>();
  for (const info of infos) {
    const r = info.metro.region || 'OTHER';
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(info);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let groupX = 0;

  for (const region of [...regionOrder, 'OTHER']) {
    const group = groups.get(region);
    if (!group || group.length === 0) continue;

    // Stack metros vertically within each region group
    let y = 0;
    let groupMaxW = 0;
    for (const info of group) {
      positions.set(info.node.id, { x: groupX, y });
      y += info.height + METRO_GAP;
      groupMaxW = Math.max(groupMaxW, info.width);
    }
    groupX += groupMaxW + REGION_GAP;
  }

  return applyMetroPositions(nodes, infos, positions);
}

export type AlignmentStrategy =
  | 'reset'
  | 'vertical'
  | 'distribute'
  | 'compact'
  | 'center'
  | 'align-top'
  | 'align-bottom'
  | 'hub-spoke'
  | 'by-region';

export interface AlignmentOption {
  id: AlignmentStrategy;
  label: string;
  description: string;
}

export const ALIGNMENT_OPTIONS: AlignmentOption[] = [
  { id: 'reset', label: 'Reset Layout', description: 'Reset all positions to default' },
  { id: 'vertical', label: 'Stack Vertical', description: 'Arrange metros top to bottom' },
  { id: 'distribute', label: 'Distribute Evenly', description: 'Equalize spacing between metros' },
  { id: 'compact', label: 'Compact', description: 'Minimize whitespace' },
  { id: 'center', label: 'Center on Canvas', description: 'Center all elements at origin' },
  { id: 'align-top', label: 'Align Top', description: 'Snap metros to same top edge' },
  { id: 'align-bottom', label: 'Align Bottom', description: 'Snap metros to same bottom edge' },
  { id: 'hub-spoke', label: 'Hub & Spoke', description: 'Most-connected metro at center' },
  { id: 'by-region', label: 'Group by Region', description: 'Cluster AMER / EMEA / APAC' },
];
