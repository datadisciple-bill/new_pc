import { describe, it, expect } from 'vitest';
import { generateDrawioXml } from './drawioExporter';
import type { ProjectConfig, MetroSelection } from '@/types/config';
import type { Node, Edge } from '@xyflow/react';

const emptyProject: ProjectConfig = {
  id: 'test',
  name: 'Test Project',
  metros: [],
  connections: [],
  textBoxes: [],
  localSites: [],
  annotationMarkers: [],
  networks: [],
};

const makeMetro = (code: string, region = 'AMER'): MetroSelection => ({
  metroCode: code,
  metroName: `Metro ${code}`,
  region,
  services: [],
});

describe('generateDrawioXml', () => {
  it('returns valid draw.io XML skeleton for empty project', () => {
    const xml = generateDrawioXml(emptyProject, [], []);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<mxfile');
    expect(xml).toContain('<diagram');
    expect(xml).toContain('<mxGraphModel');
    expect(xml).toContain('<root>');
    expect(xml).toContain('<mxCell id="0"/>');
    expect(xml).toContain('<mxCell id="1" parent="0"/>');
    expect(xml).toContain('</root>');
    expect(xml).toContain('</mxGraphModel>');
    expect(xml).toContain('</mxfile>');
  });

  it('generates metro group cells with correct styling', () => {
    const project = { ...emptyProject, metros: [makeMetro('DC', 'AMER')] };
    const nodes: Node[] = [
      {
        id: 'metro-DC',
        type: 'metroNode',
        position: { x: 0, y: 0 },
        data: { metroCode: 'DC', metroName: 'Metro DC', region: 'AMER' },
        style: { width: 472, height: 200 },
        width: 472,
        height: 200,
      },
    ];
    const xml = generateDrawioXml(project, nodes, []);
    // Metro group container
    expect(xml).toContain('style="group"');
    expect(xml).toContain('width="472"');
    expect(xml).toContain('height="200"');
    // Metro header with region color
    expect(xml).toContain('Metro DC');
    expect(xml).toContain('#3B82F6'); // AMER color
    expect(xml).toContain('#F4F4F4'); // metro background
  });

  it('generates service node cells inside metro group', () => {
    const project = {
      ...emptyProject,
      metros: [{ ...makeMetro('DC'), services: [{ id: 's1', type: 'FABRIC_PORT' as const, config: { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 }, pricing: null }] }],
    };
    const nodes: Node[] = [
      {
        id: 'metro-DC',
        type: 'metroNode',
        position: { x: 0, y: 0 },
        data: { metroCode: 'DC', metroName: 'Metro DC', region: 'AMER' },
        style: { width: 472, height: 200 },
        width: 472,
        height: 200,
      },
      {
        id: 'service-s1',
        type: 'serviceNode',
        position: { x: 16, y: 64 },
        parentId: 'metro-DC',
        data: { serviceId: 's1', serviceType: 'FABRIC_PORT', config: { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 } },
        style: { width: 204, height: 72 },
        width: 204,
        height: 72,
      },
    ];
    const xml = generateDrawioXml(project, nodes, []);
    // Service node should be a child of the metro group
    expect(xml).toContain('Fabric Port');
    expect(xml).toContain('#000000'); // black fill
    // Should contain base64 SVG icon
    expect(xml).toContain('data:image/svg+xml;base64,');
  });

  it('uses correct region colors', () => {
    const project = { ...emptyProject, metros: [makeMetro('LN', 'EMEA')] };
    const nodes: Node[] = [
      {
        id: 'metro-LN',
        type: 'metroNode',
        position: { x: 0, y: 0 },
        data: { metroCode: 'LN', metroName: 'Metro LN', region: 'EMEA' },
        style: { width: 472, height: 200 },
        width: 472,
        height: 200,
      },
    ];
    const xml = generateDrawioXml(project, nodes, []);
    expect(xml).toContain('#10B981'); // EMEA color
  });
});
