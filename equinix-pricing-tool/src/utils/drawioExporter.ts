import type { ProjectConfig } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';
import { SERVICE_TYPE_LABELS, CLOUD_PROVIDER_COLORS, NETWORK_NODE_COLORS } from '@/constants/brandColors';

import fabricPortSvg from '@/assets/icons/fabric-port.svg?raw';
import networkEdgeSvg from '@/assets/icons/network-edge.svg?raw';
import internetAccessSvg from '@/assets/icons/internet-access.svg?raw';
import cloudRouterSvg from '@/assets/icons/cloud-router.svg?raw';
import colocationSvg from '@/assets/icons/colocation.svg?raw';
import nspSvg from '@/assets/icons/nsp.svg?raw';
import crossConnectSvg from '@/assets/icons/cross-connect.svg?raw';
import buildingCorporateSvg from '@/assets/icons/building-corporate.svg?raw';
import buildingFactorySvg from '@/assets/icons/building-factory.svg?raw';
import buildingHomeSvg from '@/assets/icons/building-home.svg?raw';
import peopleUserSvg from '@/assets/icons/people-user.svg?raw';

const SERVICE_ICON_SVG: Record<string, string> = {
  FABRIC_PORT: fabricPortSvg,
  NETWORK_EDGE: networkEdgeSvg,
  INTERNET_ACCESS: internetAccessSvg,
  CLOUD_ROUTER: cloudRouterSvg,
  COLOCATION: colocationSvg,
  NSP: nspSvg,
  CROSS_CONNECT: crossConnectSvg,
};

export const LOCAL_SITE_ICON_SVG: Record<string, string> = {
  'fabric-port': fabricPortSvg,
  'network-edge': networkEdgeSvg,
  'internet-access': internetAccessSvg,
  'cloud-router': cloudRouterSvg,
  colocation: colocationSvg,
  'building-corporate': buildingCorporateSvg,
  'building-factory': buildingFactorySvg,
  'building-home': buildingHomeSvg,
  'people-user': peopleUserSvg,
};

const REGION_COLORS: Record<string, string> = {
  AMER: '#3B82F6',
  EMEA: '#10B981',
  APAC: '#8B5CF6',
};

export function resolveCloudColor(provider: string): string {
  const providerLower = provider.toLowerCase();
  for (const [name, color] of Object.entries(CLOUD_PROVIDER_COLORS)) {
    const firstWord = name.toLowerCase().split(' ')[0];
    if (providerLower.includes(firstWord)) {
      return color;
    }
  }
  return '#6B7280';
}

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

  // Generate service node cells
  for (const node of nodes) {
    if (node.type !== 'serviceNode') continue;

    const data = node.data as Record<string, unknown>;
    const serviceType = String(data.serviceType ?? '');
    const label = escapeXml(SERVICE_TYPE_LABELS[serviceType] ?? serviceType);
    const parentGroupId = nodeIdMap.get(node.parentId ?? '');
    const parentRef = parentGroupId != null ? parentGroupId : 1;

    const sx = node.position.x;
    const sy = node.position.y;
    const sw = node.width ?? (node.style as Record<string, number>)?.width ?? 204;
    const sh = node.height ?? (node.style as Record<string, number>)?.height ?? 72;

    const serviceId = nextId++;
    nodeIdMap.set(node.id, serviceId);

    // Service rectangle: black fill, white text, left padding for icon
    cells.push(`      <mxCell id="${serviceId}" value="${label}" style="rounded=1;fillColor=#000000;fontColor=#FFFFFF;fontSize=10;fontStyle=1;fontFamily=Arial;whiteSpace=wrap;verticalAlign=middle;spacingLeft=28;" vertex="1" parent="${parentRef}"><mxGeometry x="${sx}" y="${sy}" width="${sw}" height="${sh}" as="geometry"/></mxCell>`);

    // Icon image inside the service cell
    const rawSvg = SERVICE_ICON_SVG[serviceType] ?? '';
    const iconBase64 = btoa(rawSvg);
    const iconId = nextId++;
    cells.push(`      <mxCell id="${iconId}" value="" style="shape=image;image=data:image/svg+xml;base64,${iconBase64};imageWidth=20;imageHeight=20;" vertex="1" parent="${serviceId}"><mxGeometry x="4" y="${(sh - 24) / 2}" width="24" height="24" as="geometry"/></mxCell>`);
  }

  // Generate cloud node cells
  for (const node of nodes) {
    if (node.type !== 'cloudNode') continue;

    const data = node.data as Record<string, unknown>;
    const provider = String(data.provider ?? '');
    const fillColor = resolveCloudColor(provider);
    const label = escapeXml(provider);

    const cx = node.position.x;
    const cy = node.position.y;
    const cw = node.width ?? (node.style as Record<string, number>)?.width ?? 160;
    const ch = node.height ?? (node.style as Record<string, number>)?.height ?? 50;

    const cloudId = nextId++;
    nodeIdMap.set(node.id, cloudId);

    cells.push(`      <mxCell id="${cloudId}" value="${label}" style="rounded=1;fillColor=${fillColor};fontColor=#FFFFFF;fontSize=10;fontStyle=1;fontFamily=Arial;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="${cx}" y="${cy}" width="${cw}" height="${ch}" as="geometry"/></mxCell>`);
  }

  // Generate floaty nodes (textBox, localSite, annotationMarker, annotationLegend, multipointNetwork)
  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;
    const x = node.position.x;
    const y = node.position.y;
    const w = node.width ?? (node.style as Record<string, number>)?.width ?? 150;
    const h = node.height ?? (node.style as Record<string, number>)?.height ?? 40;

    switch (node.type) {
      case 'textBoxNode': {
        const textId = nextId++;
        const text = escapeXml(String(data.text ?? ''));
        cells.push(`      <mxCell id="${textId}" value="${text}" style="text;fillColor=none;strokeColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;fontFamily=Arial;fontSize=10;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
        break;
      }

      case 'localSiteNode': {
        const siteId = nextId++;
        nodeIdMap.set(node.id, siteId);
        const name = escapeXml(String(data.name ?? ''));
        const description = data.description ? escapeXml(String(data.description)) : '';
        const label = description ? `${name}&lt;br/&gt;&lt;font style=&quot;font-size:8px&quot;&gt;${description}&lt;/font&gt;` : name;

        cells.push(`      <mxCell id="${siteId}" value="${label}" style="rounded=1;fillColor=#FFFFFF;strokeColor=#CCCCCC;fontColor=#000000;fontSize=10;fontStyle=1;fontFamily=Arial;whiteSpace=wrap;html=1;verticalAlign=middle;spacingLeft=28;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);

        // Icon image
        const iconKey = String(data.icon ?? '');
        const rawSvg = LOCAL_SITE_ICON_SVG[iconKey] ?? '';
        if (rawSvg) {
          const iconBase64 = btoa(rawSvg);
          const iconId = nextId++;
          cells.push(`      <mxCell id="${iconId}" value="" style="shape=image;image=data:image/svg+xml;base64,${iconBase64};imageWidth=20;imageHeight=20;" vertex="1" parent="${siteId}"><mxGeometry x="4" y="${(h - 24) / 2}" width="24" height="24" as="geometry"/></mxCell>`);
        }
        break;
      }

      case 'annotationMarkerNode': {
        const markerId = nextId++;
        const color = String(data.color ?? '#E91C24');
        const number = String(data.number ?? '');
        cells.push(`      <mxCell id="${markerId}" value="${number}" style="ellipse;fillColor=${color};fontColor=#FFFFFF;strokeColor=none;fontSize=12;fontStyle=1;fontFamily=Arial;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
        break;
      }

      case 'annotationLegendNode': {
        const legendId = nextId++;
        const markers = (data.markers ?? []) as Array<{ id: string; number: number; x: number; y: number; color: string; text: string }>;
        const rows = markers.map(m => `<b style="color:${escapeXml(m.color)}">${m.number}</b> ${escapeXml(m.text)}`).join('<br/>');
        const legendLabel = `<div style="text-align:left;padding:8px;">${rows}</div>`;
        const legendH = Math.max(h, markers.length * 24 + 16);

        cells.push(`      <mxCell id="${legendId}" value="${escapeXml(legendLabel)}" style="rounded=1;fillColor=#FFFFFF;strokeColor=#CCCCCC;html=1;whiteSpace=wrap;fontFamily=Arial;fontSize=10;align=left;verticalAlign=top;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${legendH}" as="geometry"/></mxCell>`);
        break;
      }

      case 'multipointNetworkNode': {
        const netId = nextId++;
        nodeIdMap.set(node.id, netId);
        const netType = String(data.type ?? '');
        const fillColor = NETWORK_NODE_COLORS[netType] ?? '#6B7280';
        const netLabel = escapeXml(String(data.name ?? ''));

        cells.push(`      <mxCell id="${netId}" value="${netLabel}" style="rounded=1;fillColor=${fillColor};fontColor=#FFFFFF;fontSize=10;fontStyle=1;fontFamily=Arial;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
        break;
      }

      default:
        break;
    }
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
