import { describe, it, expect } from 'vitest';
import { buildDiagramLayout } from './diagramLayout';
import type { MetroSelection, VirtualConnection, TextBox, LocalSite, AnnotationMarker } from '@/types/config';

const makeMetro = (code: string, services: MetroSelection['services'] = []): MetroSelection => ({
  metroCode: code,
  metroName: `Metro ${code}`,
  region: 'AMER',
  services,
});

const makeService = (id: string, type: MetroSelection['services'][0]['type'], config?: Record<string, unknown>): MetroSelection['services'][0] => ({
  id,
  type,
  config: {
    ...(type === 'FABRIC_PORT' ? { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 } : {}),
    ...(type === 'NETWORK_EDGE' ? { deviceTypeCode: 'CSR', deviceTypeName: 'Cisco', vendorName: 'Cisco', packageCode: 'STD', softwareVersion: '', licenseType: 'SUBSCRIPTION', redundant: false, termLength: 1 } : {}),
    ...(type === 'CLOUD_ROUTER' ? { package: 'STANDARD' } : {}),
    ...(type === 'INTERNET_ACCESS' ? { bandwidthMbps: 100, routingProtocol: 'BGP', connectionType: 'SINGLE', deliveryMethod: 'FABRIC_PORT' } : {}),
    ...(type === 'COLOCATION' ? { description: 'Cage', mrcPrice: 0 } : {}),
    ...(type === 'NSP' ? { providerName: 'ISP' } : {}),
    ...config,
  } as MetroSelection['services'][0]['config'],
  pricing: null,
});

const makeConnection = (id: string, aSide: VirtualConnection['aSide'], zSide: VirtualConnection['zSide']): VirtualConnection => ({
  id,
  name: `Conn ${id}`,
  type: 'EVPL_VC',
  aSide,
  zSide,
  bandwidthMbps: 1000,
  redundant: false,
  pricing: null,
  showPriceTable: false,
  priceTable: null,
});

describe('buildDiagramLayout', () => {
  it('returns empty layout for no metros', () => {
    const { nodes, edges } = buildDiagramLayout([], []);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('creates metro node and service nodes', () => {
    const metros = [makeMetro('DC', [makeService('s1', 'FABRIC_PORT')])];
    const { nodes } = buildDiagramLayout(metros, []);

    const metroNode = nodes.find((n) => n.id === 'metro-DC');
    expect(metroNode).toBeDefined();
    expect(metroNode?.type).toBe('metroNode');

    const serviceNode = nodes.find((n) => n.id === 'service-s1');
    expect(serviceNode).toBeDefined();
    expect(serviceNode?.type).toBe('serviceNode');
    expect(serviceNode?.parentId).toBe('metro-DC');
  });

  it('places left and right column services correctly', () => {
    const metros = [makeMetro('DC', [
      makeService('port1', 'FABRIC_PORT'),
      makeService('ne1', 'NETWORK_EDGE'),
    ])];
    const { nodes } = buildDiagramLayout(metros, []);

    const portNode = nodes.find((n) => n.id === 'service-port1');
    const neNode = nodes.find((n) => n.id === 'service-ne1');

    // Port is left column, NE is right column — NE should have larger x
    expect(portNode!.position.x).toBeLessThan(neNode!.position.x);
  });

  it('creates cloud provider nodes for SERVICE_PROFILE connections', () => {
    const metros = [makeMetro('DC', [makeService('s1', 'FABRIC_PORT')])];
    const connections = [makeConnection('c1',
      { metroCode: 'DC', type: 'PORT', serviceId: 's1' },
      { metroCode: 'DC', type: 'SERVICE_PROFILE', serviceId: 'aws', serviceProfileName: 'AWS Direct Connect' },
    )];

    const { nodes, edges } = buildDiagramLayout(metros, connections);

    const cloudNode = nodes.find((n) => n.id === 'cloud-AWS-Direct-Connect');
    expect(cloudNode).toBeDefined();
    expect(cloudNode?.type).toBe('cloudNode');

    expect(edges).toHaveLength(1);
    expect(edges[0].target).toBe('cloud-AWS-Direct-Connect');
  });

  it('creates edge with bandwidth label', () => {
    const metros = [makeMetro('DC', [makeService('s1', 'FABRIC_PORT'), makeService('s2', 'NETWORK_EDGE')])];
    const connections = [makeConnection('c1',
      { metroCode: 'DC', type: 'PORT', serviceId: 's1' },
      { metroCode: 'DC', type: 'NETWORK_EDGE', serviceId: 's2' },
    )];

    const { edges } = buildDiagramLayout(metros, connections);
    expect(edges[0].data.labelLine1).toBe('1G');
  });

  it('shows redundant label on edges', () => {
    const metros = [makeMetro('DC', [makeService('s1', 'FABRIC_PORT')])];
    const conn: VirtualConnection = {
      ...makeConnection('c1',
        { metroCode: 'DC', type: 'PORT', serviceId: 's1' },
        { metroCode: 'NY', type: 'PORT', serviceId: 's2' },
      ),
      redundant: true,
    };

    const { edges } = buildDiagramLayout(metros, [conn]);
    expect(edges[0].data.labelLine1).toContain('×2');
  });

  it('creates text box nodes', () => {
    const textBoxes: TextBox[] = [
      { id: 'tb1', text: 'Note', x: 100, y: 200, width: 150, height: 50 },
    ];

    const { nodes } = buildDiagramLayout([], [], true, textBoxes);
    const tbNode = nodes.find((n) => n.id === 'textbox-tb1');
    expect(tbNode).toBeDefined();
    expect(tbNode?.data.text).toBe('Note');
  });

  it('creates local site nodes', () => {
    const localSites: LocalSite[] = [
      { id: 'ls1', name: 'HQ', description: 'Headquarters', icon: 'building-corporate', x: 50, y: 50 },
    ];

    const { nodes } = buildDiagramLayout([], [], true, [], localSites);
    const lsNode = nodes.find((n) => n.id === 'localsite-ls1');
    expect(lsNode).toBeDefined();
    expect(lsNode?.data.name).toBe('HQ');
  });

  it('creates annotation markers and legend', () => {
    const markers: AnnotationMarker[] = [
      { id: 'm1', number: 1, x: 10, y: 10, color: '#E91C24', text: 'Primary' },
      { id: 'm2', number: 2, x: 20, y: 20, color: '#E91C24', text: 'Secondary' },
    ];

    const { nodes } = buildDiagramLayout([], [], true, [], [], markers);

    const m1 = nodes.find((n) => n.id === 'marker-m1');
    expect(m1).toBeDefined();
    expect(m1?.type).toBe('annotationMarkerNode');

    const legend = nodes.find((n) => n.id === 'annotation-legend');
    expect(legend).toBeDefined();
    expect(legend?.type).toBe('annotationLegendNode');
  });

  it('lays out multiple metros in a 2-column grid', () => {
    const metros = [
      makeMetro('DC', [makeService('s1', 'FABRIC_PORT')]),
      makeMetro('NY', [makeService('s2', 'FABRIC_PORT')]),
      makeMetro('LD', [makeService('s3', 'FABRIC_PORT')]),
    ];

    const { nodes } = buildDiagramLayout(metros, []);
    const dcNode = nodes.find((n) => n.id === 'metro-DC')!;
    const nyNode = nodes.find((n) => n.id === 'metro-NY')!;
    const ldNode = nodes.find((n) => n.id === 'metro-LD')!;

    // DC and NY should be in same row (different x, same y)
    expect(dcNode.position.y).toBe(nyNode.position.y);
    expect(dcNode.position.x).not.toBe(nyNode.position.x);

    // LD should be in second row (y > DC's y)
    expect(ldNode.position.y).toBeGreaterThan(dcNode.position.y);
  });

  it('uses dashed stroke for IP_VC connections', () => {
    const metros = [makeMetro('DC', [makeService('s1', 'FABRIC_PORT'), makeService('s2', 'CLOUD_ROUTER')])];
    const conn: VirtualConnection = {
      ...makeConnection('c1',
        { metroCode: 'DC', type: 'PORT', serviceId: 's1' },
        { metroCode: 'DC', type: 'CLOUD_ROUTER', serviceId: 's2' },
      ),
      type: 'IP_VC',
    };

    const { edges } = buildDiagramLayout(metros, [conn]);
    expect(edges[0].style?.strokeDasharray).toBe('8 4');
  });

  it('uses green stroke for same-metro connections', () => {
    const metros = [makeMetro('DC', [makeService('s1', 'FABRIC_PORT'), makeService('s2', 'NETWORK_EDGE')])];
    const conn = makeConnection('c1',
      { metroCode: 'DC', type: 'PORT', serviceId: 's1' },
      { metroCode: 'DC', type: 'NETWORK_EDGE', serviceId: 's2' },
    );

    const { edges } = buildDiagramLayout(metros, [conn]);
    expect(edges[0].style?.stroke).toBe('#33A85C');
  });

  it('uses gray stroke for local site connections', () => {
    const localSites: LocalSite[] = [
      { id: 'ls1', name: 'HQ', description: '', icon: 'building-corporate', x: 0, y: 0 },
    ];
    const metros = [makeMetro('DC', [makeService('s1', 'FABRIC_PORT')])];
    const conn = makeConnection('c1',
      { metroCode: 'DC', type: 'LOCAL_SITE', serviceId: 'ls1' },
      { metroCode: 'DC', type: 'PORT', serviceId: 's1' },
    );

    const { edges } = buildDiagramLayout(metros, [conn], true, [], localSites);
    expect(edges[0].style?.stroke).toBe('#6B7280');
  });
});
