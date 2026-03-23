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

  it('generates cloud node with brand color derived from provider name', () => {
    const nodes: Node[] = [
      {
        id: 'cloud-aws-1',
        type: 'cloudNode',
        position: { x: 600, y: 100 },
        data: { provider: 'AWS Direct Connect', cloudRegion: 'us-east-1', cloudMetro: 'DC' },
        style: { width: 160, height: 50 },
        width: 160,
        height: 50,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('AWS Direct Connect');
    expect(xml).toContain('#FF9900'); // looked up from CLOUD_PROVIDER_COLORS via fuzzy match
    expect(xml).toContain('rounded=1');
  });

  it('generates text box node', () => {
    const nodes: Node[] = [
      {
        id: 'textbox-t1',
        type: 'textBoxNode',
        position: { x: 100, y: 100 },
        data: { text: 'Hello World' },
        style: { width: 150, height: 40 },
        width: 150,
        height: 40,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('Hello World');
    expect(xml).toContain('fillColor=none');
  });

  it('generates local site node with icon', () => {
    const nodes: Node[] = [
      {
        id: 'localsite-ls1',
        type: 'localSiteNode',
        position: { x: 200, y: 200 },
        data: { localSiteId: 'ls1', name: 'HQ Office', description: 'Main campus', icon: 'building-corporate' },
        style: { width: 204, height: 52 },
        width: 204,
        height: 52,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('HQ Office');
    expect(xml).toContain('data:image/svg+xml;base64,');
  });

  it('generates annotation marker as red circle', () => {
    const nodes: Node[] = [
      {
        id: 'marker-m1',
        type: 'annotationMarkerNode',
        position: { x: 50, y: 50 },
        data: { markerId: 'm1', number: 1, color: '#E91C24' },
        style: { width: 28, height: 28 },
        width: 28,
        height: 28,
      },
    ];
    const project = {
      ...emptyProject,
      annotationMarkers: [{ id: 'm1', number: 1, x: 50, y: 50, color: '#E91C24', text: 'Primary link' }],
    };
    const xml = generateDrawioXml(project, nodes, []);
    expect(xml).toContain('ellipse');
    expect(xml).toContain('#E91C24');
    expect(xml).toContain('value="1"');
  });

  it('generates annotation legend node', () => {
    const nodes: Node[] = [
      {
        id: 'annotation-legend',
        type: 'annotationLegendNode',
        position: { x: 600, y: 0 },
        data: {
          markers: [
            { id: 'm1', number: 1, x: 50, y: 50, color: '#E91C24', text: 'Primary link' },
            { id: 'm2', number: 2, x: 100, y: 100, color: '#E91C24', text: 'Backup link' },
          ],
        },
        style: { width: 260 },
        width: 260,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('Primary link');
    expect(xml).toContain('Backup link');
  });

  it('generates multipoint network node', () => {
    const nodes: Node[] = [
      {
        id: 'network-n1',
        type: 'multipointNetworkNode',
        position: { x: 300, y: 300 },
        data: { networkId: 'n1', name: 'EVP-LAN', type: 'EVPLAN', scope: 'LOCAL' },
        style: { width: 160, height: 50 },
        width: 160,
        height: 50,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('EVP-LAN');
    expect(xml).toContain('#0067B8');
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
