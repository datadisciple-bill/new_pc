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

  it('generates price table node with HTML table label', () => {
    const nodes: Node[] = [
      {
        id: 'pricetable-c1',
        type: 'priceTableNode',
        position: { x: 0, y: 400 },
        data: {
          connectionId: 'c1',
          connectionName: 'EVPL VC',
          selectedBandwidthMbps: 1000,
          priceTable: [
            { bandwidthMbps: 500, label: '500 Mbps', mrc: 500, currency: 'USD' },
            { bandwidthMbps: 1000, label: '1 Gbps', mrc: 800, currency: 'USD' },
          ],
        },
        style: { width: 200, height: 60 },
        width: 200,
        height: 60,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('EVPL VC');
    expect(xml).toContain('500 Mbps');
    expect(xml).toContain('1 Gbps');
    // HTML table is XML-escaped inside the value attribute
    expect(xml).toContain('&lt;table');
  });

  it('generates NE price table node with cores columns', () => {
    const nodes: Node[] = [
      {
        id: 'nepricetable-s1',
        type: 'nePriceTableNode',
        position: { x: 0, y: 500 },
        data: {
          serviceId: 's1',
          metroCode: 'DC',
          serviceName: 'CSR 1000v',
          selectedCores: 4,
          priceTable: [
            { cores: 2, mrc: 200, nrc: 100 },
            { cores: 4, mrc: 400, nrc: 200 },
          ],
          termLength: 1,
        },
        style: { width: 220, height: 60 },
        width: 220,
        height: 60,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('CSR 1000v');
    expect(xml).toContain('&lt;table');
    expect(xml).toContain('Cores');
    expect(xml).toContain('MRC');
    expect(xml).toContain('NRC');
  });

  it('generates EIA price table node without selection highlighting', () => {
    const nodes: Node[] = [
      {
        id: 'eiapricetable-s2',
        type: 'eiaPriceTableNode',
        position: { x: 0, y: 600 },
        data: {
          serviceId: 's2',
          metroCode: 'DC',
          serviceName: 'Internet Access',
          priceTable: [
            { bandwidthMbps: 100, label: '100 Mbps', mrc: 300, currency: 'USD' },
          ],
        },
        style: { width: 200, height: 60 },
        width: 200,
        height: 60,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('Internet Access');
    expect(xml).toContain('&lt;table');
    expect(xml).toContain('100 Mbps');
  });

  it('highlights selected bandwidth row in VC price table', () => {
    const nodes: Node[] = [
      {
        id: 'pricetable-c1',
        type: 'priceTableNode',
        position: { x: 0, y: 400 },
        data: {
          connectionId: 'c1',
          connectionName: 'EVPL VC',
          selectedBandwidthMbps: 1000,
          priceTable: [
            { bandwidthMbps: 500, label: '500 Mbps', mrc: 500, currency: 'USD' },
            { bandwidthMbps: 1000, label: '1 Gbps', mrc: 800, currency: 'USD' },
          ],
        },
        style: { width: 200, height: 60 },
        width: 200,
        height: 60,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    // The selected row (1 Gbps) should have bold styling
    expect(xml).toContain('font-weight:bold');
  });

  it('shows discount banner for NE price table with term > 1', () => {
    const nodes: Node[] = [
      {
        id: 'nepricetable-s1',
        type: 'nePriceTableNode',
        position: { x: 0, y: 500 },
        data: {
          serviceId: 's1',
          metroCode: 'DC',
          serviceName: 'CSR 1000v',
          selectedCores: 4,
          priceTable: [
            { cores: 2, mrc: 200, nrc: 100 },
            { cores: 4, mrc: 400, nrc: 200 },
          ],
          termLength: 36,
        },
        style: { width: 220, height: 60 },
        width: 220,
        height: 60,
      },
    ];
    const xml = generateDrawioXml(emptyProject, nodes, []);
    expect(xml).toContain('36');
    expect(xml).toContain('month');
  });

  it('generates logical connector edge with correct style', () => {
    const nodes: Node[] = [
      {
        id: 'metro-DC', type: 'metroNode', position: { x: 0, y: 0 },
        data: { metroCode: 'DC', metroName: 'Metro DC', region: 'AMER' },
        style: { width: 472, height: 200 }, width: 472, height: 200,
      },
      {
        id: 'metro-SV', type: 'metroNode', position: { x: 600, y: 0 },
        data: { metroCode: 'SV', metroName: 'Metro SV', region: 'AMER' },
        style: { width: 472, height: 200 }, width: 472, height: 200,
      },
      {
        id: 'service-s1', type: 'serviceNode', position: { x: 16, y: 64 },
        parentId: 'metro-DC',
        data: { serviceId: 's1', serviceType: 'FABRIC_PORT' },
        style: { width: 204, height: 72 }, width: 204, height: 72,
      },
      {
        id: 'service-s2', type: 'serviceNode', position: { x: 16, y: 64 },
        parentId: 'metro-SV',
        data: { serviceId: 's2', serviceType: 'NETWORK_EDGE' },
        style: { width: 204, height: 72 }, width: 204, height: 72,
      },
    ];
    const edges: Edge[] = [
      {
        id: 'edge-c1',
        source: 'service-s1',
        target: 'service-s2',
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
        type: 'customEdge',
        style: { stroke: '#33A85C', strokeWidth: 1.5 },
        data: {
          connectionId: 'c1',
          labelLine1: 'EVPL 1 Gbps',
          labelLine2: '$800/mo',
          isRedundant: false,
          isSameMetro: false,
        },
      },
    ];
    const project = {
      ...emptyProject,
      metros: [
        { metroCode: 'DC', metroName: 'Metro DC', region: 'AMER', services: [{ id: 's1', type: 'FABRIC_PORT' as const, config: { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 }, pricing: null }] },
        { metroCode: 'SV', metroName: 'Metro SV', region: 'AMER', services: [{ id: 's2', type: 'NETWORK_EDGE' as const, config: { deviceTypeCode: 'CSR', deviceTypeName: 'Cisco', vendorName: 'Cisco', packageCode: 'STD', softwareVersion: '', licenseType: 'SUBSCRIPTION', redundant: false, termLength: 1 }, pricing: null }] },
      ],
    };
    const xml = generateDrawioXml(project, nodes, edges);

    expect(xml).toContain('edge="1"');
    expect(xml).toContain('source=');
    expect(xml).toContain('target=');
    expect(xml).toContain('#33A85C');
    expect(xml).toContain('EVPL 1 Gbps');
    // Handle sides: right exit, left entry
    expect(xml).toContain('exitX=1');
    expect(xml).toContain('entryX=0');
  });

  it('generates two connectors for redundant edges', () => {
    const nodes: Node[] = [
      { id: 'metro-DC', type: 'metroNode', position: { x: 0, y: 0 }, data: { metroCode: 'DC', metroName: 'Metro DC', region: 'AMER' }, style: { width: 472, height: 200 }, width: 472, height: 200 },
      { id: 'service-s1', type: 'serviceNode', position: { x: 16, y: 64 }, parentId: 'metro-DC', data: { serviceId: 's1', serviceType: 'FABRIC_PORT' }, style: { width: 204, height: 72 }, width: 204, height: 72 },
      { id: 'service-s2', type: 'serviceNode', position: { x: 250, y: 64 }, parentId: 'metro-DC', data: { serviceId: 's2', serviceType: 'NETWORK_EDGE' }, style: { width: 204, height: 72 }, width: 204, height: 72 },
    ];
    const edges: Edge[] = [
      {
        id: 'edge-c2',
        source: 'service-s1', target: 'service-s2',
        sourceHandle: 'right-source', targetHandle: 'left-target',
        type: 'customEdge',
        style: { stroke: '#33A85C', strokeWidth: 1.5 },
        data: { connectionId: 'c2', labelLine1: 'Redundant EVPL', isRedundant: true, isSameMetro: true },
      },
    ];
    const project = {
      ...emptyProject,
      metros: [{ metroCode: 'DC', metroName: 'Metro DC', region: 'AMER', services: [
        { id: 's1', type: 'FABRIC_PORT' as const, config: { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 }, pricing: null },
        { id: 's2', type: 'NETWORK_EDGE' as const, config: { deviceTypeCode: 'CSR', deviceTypeName: 'Cisco', vendorName: 'Cisco', packageCode: 'STD', softwareVersion: '', licenseType: 'SUBSCRIPTION', redundant: false, termLength: 1 }, pricing: null },
      ] }],
    };
    const xml = generateDrawioXml(project, nodes, edges);
    const edgeMatches = xml.match(/edge="1"/g);
    expect(edgeMatches?.length).toBeGreaterThanOrEqual(2);
  });

  it('generates dashed edge when strokeDasharray is set', () => {
    const nodes: Node[] = [
      { id: 'metro-DC', type: 'metroNode', position: { x: 0, y: 0 }, data: { metroCode: 'DC', metroName: 'Metro DC', region: 'AMER' }, style: { width: 472, height: 200 }, width: 472, height: 200 },
      { id: 'service-s1', type: 'serviceNode', position: { x: 16, y: 64 }, parentId: 'metro-DC', data: { serviceId: 's1', serviceType: 'FABRIC_PORT' }, style: { width: 204, height: 72 }, width: 204, height: 72 },
      { id: 'service-s2', type: 'serviceNode', position: { x: 250, y: 64 }, parentId: 'metro-DC', data: { serviceId: 's2', serviceType: 'NETWORK_EDGE' }, style: { width: 204, height: 72 }, width: 204, height: 72 },
    ];
    const edges: Edge[] = [
      {
        id: 'edge-c3',
        source: 'service-s1', target: 'service-s2',
        sourceHandle: 'bottom-source', targetHandle: 'top-target',
        type: 'customEdge',
        style: { stroke: '#0067B8', strokeWidth: 1.5, strokeDasharray: '4 3' },
        data: { connectionId: 'c3', labelLine1: 'Network Link', isRedundant: false, isSameMetro: true },
      },
    ];
    const project = {
      ...emptyProject,
      metros: [{ metroCode: 'DC', metroName: 'Metro DC', region: 'AMER', services: [
        { id: 's1', type: 'FABRIC_PORT' as const, config: { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 }, pricing: null },
        { id: 's2', type: 'NETWORK_EDGE' as const, config: { deviceTypeCode: 'CSR', deviceTypeName: 'Cisco', vendorName: 'Cisco', packageCode: 'STD', softwareVersion: '', licenseType: 'SUBSCRIPTION', redundant: false, termLength: 1 }, pricing: null },
      ] }],
    };
    const xml = generateDrawioXml(project, nodes, edges);
    expect(xml).toContain('dashed=1');
    expect(xml).toContain('exitY=1'); // bottom
    expect(xml).toContain('entryY=0'); // top
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
