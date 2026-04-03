import { describe, it, expect } from 'vitest';
import {
  mapPortsToServices,
  mapRouterToService,
  mapDeviceToService,
  mapConnectionToVC,
  buildInventory,
} from './environmentMapper';
import type { PortResponse, ConnectionResponse, RouterResponse, DeviceResponse } from '@/types/equinix';

describe('mapPortsToServices', () => {
  it('maps a single non-redundant port to a PRIMARY FABRIC_PORT service', () => {
    const port: PortResponse = {
      uuid: 'p1', name: 'SV5-1G', type: 'XF_PORT', state: 'ACTIVE',
      location: { metroCode: 'SV', metroName: 'Silicon Valley' },
      encapsulation: { type: 'QINQ' }, physicalPortSpeed: 1000, physicalPortQuantity: 1,
      redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' },
    };
    const services = mapPortsToServices([port]);
    expect(services).toHaveLength(1);
    expect(services[0].type).toBe('FABRIC_PORT');
    expect(services[0].isExisting).toBe(true);
    expect(services[0].sourceId).toBe('p1');
    const config = services[0].config as { speed: string; encapsulation: string; type: string };
    expect(config.speed).toBe('1G');
    expect(config.encapsulation).toBe('QINQ');
    expect(config.type).toBe('PRIMARY');
  });

  it('groups redundant port pairs into a single REDUNDANT service', () => {
    const ports: PortResponse[] = [
      {
        uuid: 'p1', name: 'DA-Primary', type: 'XF_PORT', state: 'ACTIVE',
        location: { metroCode: 'DA', metroName: 'Dallas' },
        encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: 10000, physicalPortQuantity: 1,
        redundancy: { enabled: true, group: 'grp-1' }, account: { orgId: 'org1' },
      },
      {
        uuid: 'p2', name: 'DA-Secondary', type: 'XF_PORT', state: 'ACTIVE',
        location: { metroCode: 'DA', metroName: 'Dallas' },
        encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: 10000, physicalPortQuantity: 1,
        redundancy: { enabled: true, group: 'grp-1' }, account: { orgId: 'org1' },
      },
    ];
    const services = mapPortsToServices(ports);
    expect(services).toHaveLength(1);
    const config = services[0].config as { type: string; speed: string };
    expect(config.type).toBe('REDUNDANT');
    expect(config.speed).toBe('10G');
    expect(services[0].sourceId).toBe('p1');
  });

  it('maps port speeds correctly', () => {
    const makePort = (speed: number): PortResponse => ({
      uuid: `p-${speed}`, name: `Port-${speed}`, type: 'XF_PORT', state: 'ACTIVE',
      location: { metroCode: 'DA', metroName: 'Dallas' },
      encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: speed, physicalPortQuantity: 1,
      redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' },
    });

    const test1G = mapPortsToServices([makePort(1000)]);
    expect((test1G[0].config as { speed: string }).speed).toBe('1G');

    const test10G = mapPortsToServices([makePort(10000)]);
    expect((test10G[0].config as { speed: string }).speed).toBe('10G');

    const test100G = mapPortsToServices([makePort(100000)]);
    expect((test100G[0].config as { speed: string }).speed).toBe('100G');

    const test400G = mapPortsToServices([makePort(400000)]);
    expect((test400G[0].config as { speed: string }).speed).toBe('400G');
  });
});

describe('mapRouterToService', () => {
  it('maps a router to CLOUD_ROUTER service', () => {
    const router: RouterResponse = {
      uuid: 'r1', name: 'FCR-Standard', state: 'PROVISIONED',
      location: { metroCode: 'DA', metroName: 'Dallas' }, package: { code: 'STANDARD' },
    };
    const service = mapRouterToService(router);
    expect(service.type).toBe('CLOUD_ROUTER');
    expect(service.isExisting).toBe(true);
    expect(service.sourceId).toBe('r1');
    expect((service.config as { package: string }).package).toBe('STANDARD');
  });
});

describe('mapDeviceToService', () => {
  it('maps a device to NETWORK_EDGE service', () => {
    const device: DeviceResponse = {
      uuid: 'd1', name: 'CSR1000v', status: 'PROVISIONED', metroCode: 'DA',
      deviceTypeCode: 'CSR1000V', vendorName: 'Cisco', packageCode: 'SEC',
      coreCount: 4, softwareVersion: '17.3.4a', licenseType: 'SUBSCRIPTION',
      redundant: false, termLength: 12,
    };
    const service = mapDeviceToService(device);
    expect(service.type).toBe('NETWORK_EDGE');
    expect(service.isExisting).toBe(true);
    expect(service.sourceId).toBe('d1');
    const config = service.config as { deviceTypeCode: string; coreMemory: string; termLength: number; licenseType: string };
    expect(config.deviceTypeCode).toBe('CSR1000V');
    expect(config.coreMemory).toBe('4 Cores');
    expect(config.termLength).toBe(12);
    expect(config.licenseType).toBe('SUBSCRIPTION');
  });

  it('maps BYOL license type correctly', () => {
    const device: DeviceResponse = {
      uuid: 'd2', name: 'PA-VM', status: 'PROVISIONED', metroCode: 'SV',
      deviceTypeCode: 'PA-VM', vendorName: 'Palo Alto', packageCode: 'VM-300',
      coreCount: 4, softwareVersion: '10.2.3', licenseType: 'BYOL',
      redundant: true, termLength: 24,
    };
    const service = mapDeviceToService(device);
    const config = service.config as { licenseType: string; redundant: boolean };
    expect(config.licenseType).toBe('BYOL');
    expect(config.redundant).toBe(true);
  });
});

describe('mapConnectionToVC', () => {
  it('resolves port-based endpoints via serviceIdMap', () => {
    const conn: ConnectionResponse = {
      uuid: 'c1', name: 'Test-VC', type: 'EVPL_VC', state: 'ACTIVE', bandwidth: 1000,
      aSide: { accessPoint: { type: 'COLO', port: { uuid: 'port-1' }, location: { metroCode: 'DA' } } },
      zSide: { accessPoint: { type: 'COLO', port: { uuid: 'port-2' }, location: { metroCode: 'SV' } } },
    };
    const serviceIdMap = new Map([['port-1', 'svc-aaa'], ['port-2', 'svc-bbb']]);
    const result = mapConnectionToVC(conn, serviceIdMap);
    expect(result.warnings).toHaveLength(0);
    expect(result.connection.aSide.serviceId).toBe('svc-aaa');
    expect(result.connection.zSide.serviceId).toBe('svc-bbb');
    expect(result.connection.isExisting).toBe(true);
    expect(result.connection.sourceId).toBe('c1');
    expect(result.connection.bandwidthMbps).toBe(1000);
  });

  it('warns when endpoint references unimported resource', () => {
    const conn: ConnectionResponse = {
      uuid: 'c2', name: 'Partial-VC', type: 'EVPL_VC', state: 'ACTIVE', bandwidth: 500,
      aSide: { accessPoint: { type: 'COLO', port: { uuid: 'port-known' }, location: { metroCode: 'DA' } } },
      zSide: { accessPoint: { type: 'COLO', port: { uuid: 'port-unknown' }, location: { metroCode: 'LD' } } },
    };
    const serviceIdMap = new Map([['port-known', 'svc-aaa']]);
    const result = mapConnectionToVC(conn, serviceIdMap);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('port-unknown');
    expect(result.connection.aSide.serviceId).toBe('svc-aaa');
    expect(result.connection.zSide.serviceId).toBe('');
  });

  it('warns when router endpoint is unimported', () => {
    const conn: ConnectionResponse = {
      uuid: 'c4', name: 'Router-Missing', type: 'IP_VC', state: 'ACTIVE', bandwidth: 500,
      aSide: { accessPoint: { type: 'CLOUD_ROUTER', router: { uuid: 'router-known' }, location: { metroCode: 'DA' } } },
      zSide: { accessPoint: { type: 'CLOUD_ROUTER', router: { uuid: 'router-unknown' }, location: { metroCode: 'LD' } } },
    };
    const serviceIdMap = new Map([['router-known', 'svc-r1']]);
    const result = mapConnectionToVC(conn, serviceIdMap);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('router-unknown');
  });

  it('resolves router-based endpoints', () => {
    const conn: ConnectionResponse = {
      uuid: 'c3', name: 'Router-VC', type: 'IP_VC', state: 'ACTIVE', bandwidth: 500,
      aSide: { accessPoint: { type: 'CLOUD_ROUTER', router: { uuid: 'router-1' }, location: { metroCode: 'DA' } } },
      zSide: { accessPoint: { type: 'CLOUD_ROUTER', router: { uuid: 'router-2' }, location: { metroCode: 'LD' } } },
    };
    const serviceIdMap = new Map([['router-1', 'svc-r1'], ['router-2', 'svc-r2']]);
    const result = mapConnectionToVC(conn, serviceIdMap);
    expect(result.connection.aSide.type).toBe('CLOUD_ROUTER');
    expect(result.connection.zSide.type).toBe('CLOUD_ROUTER');
    expect(result.warnings).toHaveLength(0);
  });
});

describe('buildInventory', () => {
  it('groups resources by metro and produces correct counts', () => {
    const ports: PortResponse[] = [
      { uuid: 'p1', name: 'P1', type: 'XF_PORT', state: 'ACTIVE', location: { metroCode: 'DA', metroName: 'Dallas' }, encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: 10000, physicalPortQuantity: 1, redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' } },
      { uuid: 'p2', name: 'P2', type: 'XF_PORT', state: 'ACTIVE', location: { metroCode: 'DA', metroName: 'Dallas' }, encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: 10000, physicalPortQuantity: 1, redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' } },
      { uuid: 'p3', name: 'P3', type: 'XF_PORT', state: 'ACTIVE', location: { metroCode: 'SV', metroName: 'Silicon Valley' }, encapsulation: { type: 'QINQ' }, physicalPortSpeed: 1000, physicalPortQuantity: 1, redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' } },
    ];
    const routers: RouterResponse[] = [
      { uuid: 'r1', name: 'R1', state: 'PROVISIONED', location: { metroCode: 'DA', metroName: 'Dallas' }, package: { code: 'STANDARD' } },
    ];
    const devices: DeviceResponse[] = [
      { uuid: 'd1', name: 'D1', status: 'PROVISIONED', metroCode: 'SV', deviceTypeCode: 'CSR', vendorName: 'Cisco', packageCode: 'SEC', coreCount: 4, softwareVersion: '17.3', licenseType: 'SUBSCRIPTION', redundant: false, termLength: 12 },
    ];
    const metroLookup = new Map([
      ['DA', { code: 'DA', name: 'Dallas', region: 'AMER' as const, connectedMetros: [] }],
      ['SV', { code: 'SV', name: 'Silicon Valley', region: 'AMER' as const, connectedMetros: [] }],
    ]);

    const inventory = buildInventory(ports, [], routers, devices, metroLookup);
    expect(inventory.totalPorts).toBe(3);
    expect(inventory.totalRouters).toBe(1);
    expect(inventory.totalDevices).toBe(1);
    expect(inventory.metros).toHaveLength(2);

    const da = inventory.metros.find((m) => m.metroCode === 'DA')!;
    expect(da.portCount).toBe(2);
    expect(da.routerCount).toBe(1);
    expect(da.deviceCount).toBe(0);

    const sv = inventory.metros.find((m) => m.metroCode === 'SV')!;
    expect(sv.portCount).toBe(1);
    expect(sv.deviceCount).toBe(1);
  });

  it('counts connections in both metros', () => {
    const connections: ConnectionResponse[] = [
      {
        uuid: 'c1', name: 'C1', type: 'EVPL_VC', state: 'ACTIVE', bandwidth: 1000,
        aSide: { accessPoint: { type: 'COLO', location: { metroCode: 'DA' } } },
        zSide: { accessPoint: { type: 'COLO', location: { metroCode: 'SV' } } },
      },
    ];
    const metroLookup = new Map([
      ['DA', { code: 'DA', name: 'Dallas', region: 'AMER' as const, connectedMetros: [] }],
      ['SV', { code: 'SV', name: 'Silicon Valley', region: 'AMER' as const, connectedMetros: [] }],
    ]);
    const inventory = buildInventory([], connections, [], [], metroLookup);
    expect(inventory.metros.find(m => m.metroCode === 'DA')!.connectionCount).toBe(1);
    expect(inventory.metros.find(m => m.metroCode === 'SV')!.connectionCount).toBe(1);
  });
});
