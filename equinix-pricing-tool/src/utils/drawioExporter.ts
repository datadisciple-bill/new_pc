import type { ProjectConfig } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';

const REGION_COLORS: Record<string, string> = {
  AMER: '#3B82F6',
  EMEA: '#10B981',
  APAC: '#8B5CF6',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateDrawioXml(
  config: ProjectConfig,
  nodes: Node[],
  edges: Edge[]
): string {
  const cells: string[] = [];
  cells.push('      <mxCell id="0"/>');
  cells.push('      <mxCell id="1" parent="0"/>');

  let nextId = 2;
  const nodeIdMap = new Map<string, number>();

  // Generate metro group cells
  for (const node of nodes) {
    if (node.type !== 'metroNode') continue;

    const x = node.position.x;
    const y = node.position.y;
    const w = node.width ?? (node.style as Record<string, number>)?.width ?? 472;
    const h = node.height ?? (node.style as Record<string, number>)?.height ?? 200;
    const metroName = escapeXml(String(node.data?.metroName ?? ''));
    const region = String(node.data?.region ?? 'AMER');
    const regionColor = REGION_COLORS[region] ?? REGION_COLORS.AMER;

    const groupId = nextId++;
    nodeIdMap.set(node.id, groupId);

    // Group container
    cells.push(`      <mxCell id="${groupId}" value="" style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);

    // Background rectangle
    const bgId = nextId++;
    cells.push(`      <mxCell id="${bgId}" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F4F4F4;strokeColor=#CCCCCC;" vertex="1" parent="${groupId}"><mxGeometry width="${w}" height="${h}" as="geometry"/></mxCell>`);

    // Header bar with region color
    const headerId = nextId++;
    cells.push(`      <mxCell id="${headerId}" value="${metroName}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${regionColor};fontColor=#FFFFFF;fontStyle=1;fontSize=14;arcSize=0;" vertex="1" parent="${groupId}"><mxGeometry width="${w}" height="48" as="geometry"/></mxCell>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile>
  <diagram name="${escapeXml(config.name)}" id="page1">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

export function downloadDrawio(xmlContent: string, projectName: string): void {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Equinix_Diagram_${projectName.replace(/\s+/g, '_')}_${date}.drawio`;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
