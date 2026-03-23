import type { ProjectConfig } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';

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
