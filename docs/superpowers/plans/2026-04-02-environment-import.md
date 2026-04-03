# Import Existing Environment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users import their existing Equinix ports, connections, cloud routers, and network edge devices into the diagram, tagged visually as "existing" resources.

**Architecture:** Per-resource API functions fetch from Fabric v4 and Network Edge v1, a mapper utility converts raw responses to store-compatible types with `isExisting` flags, an orchestrator hook coordinates progressive discovery (inventory summary → selective metro import), and UI components provide the import dialog + diagram styling for existing vs new resources.

**Tech Stack:** React, TypeScript, Zustand, React Flow, Vitest, Tailwind CSS

**Project root:** `equinix-pricing-tool/`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/equinix.ts` | Modify | Add PortResponse, ConnectionResponse, RouterResponse, DeviceResponse, PaginatedResponse |
| `src/types/config.ts` | Modify | Add `isExisting?`, `sourceId?` to ServiceSelection and VirtualConnection; add EnvironmentInventory type |
| `src/api/fabric.ts` | Modify | Add fetchPorts(), fetchConnections(), fetchRouters() with pagination |
| `src/api/networkEdge.ts` | Modify | Add fetchDevices() with pagination |
| `src/api/mock/fabricMock.ts` | Modify | Add mockPorts(), mockConnections(), mockRouters() |
| `src/api/mock/networkEdgeMock.ts` | Modify | Add mockDevices() |
| `src/utils/environmentMapper.ts` | Create | mapPortToService, mapRouterToService, mapDeviceToService, mapConnectionToVC, buildInventory |
| `src/hooks/useEnvironmentImport.ts` | Create | Orchestrator hook: fetchInventory, toggleMetro, importSelected |
| `src/components/import/EnvironmentImportDialog.tsx` | Create | Modal dialog with progressive import phases |
| `src/components/import/ImportButton.tsx` | Create | Toolbar button, only visible when authenticated |
| `src/components/diagram/ServiceNode.tsx` | Modify | Green dashed border + EXISTING label for imported services |
| `src/components/diagram/CustomEdge.tsx` | Modify | Green dashed line for imported connections |
| `src/components/diagram/NetworkDiagram.tsx` | Modify | Add ImportButton to toolbar, post-login toast |
| `src/utils/environmentMapper.test.ts` | Create | Unit tests for all mapper functions |
| `src/api/fabric.test.ts` | Modify | Add tests for fetchPorts, fetchConnections, fetchRouters |
| `src/api/networkEdge.test.ts` | Modify | Add tests for fetchDevices |
| `src/hooks/useEnvironmentImport.test.ts` | Create | Integration tests for the orchestrator hook |
| `src/components/import/EnvironmentImportDialog.test.tsx` | Create | Component tests for dialog phases |

---

## Task 1: API Response Types

**Files:**
- Modify: `src/types/equinix.ts:107` (append after RouterPackage interface)

- [ ] **Step 1: Add API response types to equinix.ts**

Add after line 107 in `src/types/equinix.ts`:

```typescript
// --- Environment Import: raw API response types ---

export interface PortResponse {
  uuid: string;
  name: string;
  type: string;
  state: string;
  location: { metroCode: string; metroName: string };
  encapsulation: { type: 'DOT1Q' | 'QINQ' };
  physicalPortSpeed: number;
  physicalPortQuantity: number;
  redundancy: { enabled: boolean; group: string };
  account: { orgId: string };
}

export interface ConnectionResponse {
  uuid: string;
  name: string;
  type: 'EVPL_VC' | 'IP_VC' | 'EVPLAN_VC' | 'EPLAN_VC' | 'EVPTREE_VC' | 'EPTREE_VC';
  state: string;
  bandwidth: number;
  aSide: {
    accessPoint: {
      type: string;
      port?: { uuid: string };
      router?: { uuid: string };
      profile?: { uuid: string };
      location?: { metroCode: string };
    };
  };
  zSide: {
    accessPoint: {
      type: string;
      port?: { uuid: string };
      router?: { uuid: string };
      profile?: { uuid: string };
      location?: { metroCode: string };
    };
  };
  redundancy?: { group: string; priority: 'PRIMARY' | 'SECONDARY' };
}

export interface RouterResponse {
  uuid: string;
  name: string;
  state: string;
  location: { metroCode: string; metroName: string };
  package: { code: 'STANDARD' | 'PREMIUM' };
  order?: { purchaseOrderNumber: string };
}

export interface DeviceResponse {
  uuid: string;
  name: string;
  status: string;
  metroCode: string;
  deviceTypeCode: string;
  vendorName: string;
  packageCode: string;
  coreCount: number;
  softwareVersion: string;
  licenseType: 'BYOL' | 'SUBSCRIPTION';
  redundant: boolean;
  termLength: number;
}

export interface PaginatedResponse<T> {
  pagination: Pagination;
  data: T[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add equinix-pricing-tool/src/types/equinix.ts
git commit -m "feat(types): add API response types for environment import"
```

---

## Task 2: Config Type Extensions

**Files:**
- Modify: `src/types/config.ts:68-73` (ServiceSelection interface)
- Modify: `src/types/config.ts:140-152` (VirtualConnection interface)
- Modify: `src/types/config.ts` (append EnvironmentInventory)

- [ ] **Step 1: Add isExisting and sourceId to ServiceSelection**

In `src/types/config.ts`, add two fields to the `ServiceSelection` interface (after `pricing` on line 72):

```typescript
export interface ServiceSelection {
  id: string;
  type: ServiceType;
  config: FabricPortConfig | NetworkEdgeConfig | InternetAccessConfig | CloudRouterConfig | ColocationConfig | NspConfig | CrossConnectConfig;
  pricing: PricingResult | null;
  isExisting?: boolean;
  sourceId?: string;
}
```

- [ ] **Step 2: Add isExisting and sourceId to VirtualConnection**

In the same file, add to `VirtualConnection` (after `priceTable` on line 151):

```typescript
export interface VirtualConnection {
  id: string;
  name: string;
  type: 'EVPL_VC' | 'IP_VC' | 'EVPLAN_VC' | 'EPLAN_VC' | 'EVPTREE_VC' | 'EPTREE_VC';
  aSide: ConnectionEndpoint;
  zSide: ConnectionEndpoint;
  bandwidthMbps: number;
  redundant: boolean;
  eTreeRole?: ETreeConnectionRole;
  pricing: PricingResult | null;
  showPriceTable: boolean;
  priceTable: BandwidthPriceEntry[] | null;
  isExisting?: boolean;
  sourceId?: string;
}
```

- [ ] **Step 3: Add EnvironmentInventory type**

Append to the end of `src/types/config.ts`:

```typescript
export interface EnvironmentInventoryMetro {
  metroCode: string;
  metroName: string;
  region: 'AMER' | 'EMEA' | 'APAC';
  portCount: number;
  connectionCount: number;
  routerCount: number;
  deviceCount: number;
}

export interface EnvironmentInventory {
  metros: EnvironmentInventoryMetro[];
  totalPorts: number;
  totalConnections: number;
  totalRouters: number;
  totalDevices: number;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/types/config.ts
git commit -m "feat(types): add isExisting/sourceId fields and EnvironmentInventory type"
```

---

## Task 3: Mock Data for Import

**Files:**
- Modify: `src/api/mock/fabricMock.ts:253` (append after mockRouterPackages)
- Modify: `src/api/mock/networkEdgeMock.ts:151` (append after mockNetworkEdgePricing)

- [ ] **Step 1: Add mockPorts to fabricMock.ts**

Append after line 253 in `src/api/mock/fabricMock.ts`:

```typescript
export function mockPorts(): PortResponse[] {
  return [
    // DA1 — redundant 10G pair
    {
      uuid: 'port-da1-001',
      name: 'DA1-10G-Primary',
      type: 'XF_PORT',
      state: 'ACTIVE',
      location: { metroCode: 'DA', metroName: 'Dallas' },
      encapsulation: { type: 'DOT1Q' },
      physicalPortSpeed: 10000,
      physicalPortQuantity: 1,
      redundancy: { enabled: true, group: 'red-group-da1-10g' },
      account: { orgId: 'org-001' },
    },
    {
      uuid: 'port-da1-002',
      name: 'DA1-10G-Secondary',
      type: 'XF_PORT',
      state: 'ACTIVE',
      location: { metroCode: 'DA', metroName: 'Dallas' },
      encapsulation: { type: 'DOT1Q' },
      physicalPortSpeed: 10000,
      physicalPortQuantity: 1,
      redundancy: { enabled: true, group: 'red-group-da1-10g' },
      account: { orgId: 'org-001' },
    },
    // SV — single 1G port
    {
      uuid: 'port-sv5-001',
      name: 'SV5-1G-Single',
      type: 'XF_PORT',
      state: 'ACTIVE',
      location: { metroCode: 'SV', metroName: 'Silicon Valley' },
      encapsulation: { type: 'QINQ' },
      physicalPortSpeed: 1000,
      physicalPortQuantity: 1,
      redundancy: { enabled: false, group: '' },
      account: { orgId: 'org-001' },
    },
    // LD — 10G single
    {
      uuid: 'port-ld5-001',
      name: 'LD5-10G-Single',
      type: 'XF_PORT',
      state: 'ACTIVE',
      location: { metroCode: 'LD', metroName: 'London' },
      encapsulation: { type: 'DOT1Q' },
      physicalPortSpeed: 10000,
      physicalPortQuantity: 1,
      redundancy: { enabled: false, group: '' },
      account: { orgId: 'org-001' },
    },
    // SG — redundant 1G pair
    {
      uuid: 'port-sg1-001',
      name: 'SG1-1G-Primary',
      type: 'XF_PORT',
      state: 'ACTIVE',
      location: { metroCode: 'SG', metroName: 'Singapore' },
      encapsulation: { type: 'DOT1Q' },
      physicalPortSpeed: 1000,
      physicalPortQuantity: 1,
      redundancy: { enabled: true, group: 'red-group-sg1-1g' },
      account: { orgId: 'org-001' },
    },
    {
      uuid: 'port-sg1-002',
      name: 'SG1-1G-Secondary',
      type: 'XF_PORT',
      state: 'ACTIVE',
      location: { metroCode: 'SG', metroName: 'Singapore' },
      encapsulation: { type: 'DOT1Q' },
      physicalPortSpeed: 1000,
      physicalPortQuantity: 1,
      redundancy: { enabled: true, group: 'red-group-sg1-1g' },
      account: { orgId: 'org-001' },
    },
    // DA — deprovisioned port (should be filtered out)
    {
      uuid: 'port-da1-old',
      name: 'DA1-1G-Decom',
      type: 'XF_PORT',
      state: 'DEPROVISIONED',
      location: { metroCode: 'DA', metroName: 'Dallas' },
      encapsulation: { type: 'DOT1Q' },
      physicalPortSpeed: 1000,
      physicalPortQuantity: 1,
      redundancy: { enabled: false, group: '' },
      account: { orgId: 'org-001' },
    },
  ];
}
```

- [ ] **Step 2: Add mockRouters to fabricMock.ts**

Append after `mockPorts`:

```typescript
export function mockRouters(): RouterResponse[] {
  return [
    {
      uuid: 'router-da1-001',
      name: 'DA1-FCR-Standard',
      state: 'PROVISIONED',
      location: { metroCode: 'DA', metroName: 'Dallas' },
      package: { code: 'STANDARD' },
    },
    {
      uuid: 'router-sv5-001',
      name: 'SV5-FCR-Premium',
      state: 'PROVISIONED',
      location: { metroCode: 'SV', metroName: 'Silicon Valley' },
      package: { code: 'PREMIUM' },
    },
    {
      uuid: 'router-ld5-001',
      name: 'LD5-FCR-Standard',
      state: 'PROVISIONED',
      location: { metroCode: 'LD', metroName: 'London' },
      package: { code: 'STANDARD' },
    },
  ];
}
```

- [ ] **Step 3: Add mockConnections to fabricMock.ts**

Append after `mockRouters`:

```typescript
export function mockConnections(): ConnectionResponse[] {
  return [
    // DA to SV — EVPL_VC via ports
    {
      uuid: 'conn-001',
      name: 'DA-SV-EVPL-1G',
      type: 'EVPL_VC',
      state: 'ACTIVE',
      bandwidth: 1000,
      aSide: {
        accessPoint: {
          type: 'COLO',
          port: { uuid: 'port-da1-001' },
          location: { metroCode: 'DA' },
        },
      },
      zSide: {
        accessPoint: {
          type: 'COLO',
          port: { uuid: 'port-sv5-001' },
          location: { metroCode: 'SV' },
        },
      },
    },
    // DA to LD — IP_VC via routers
    {
      uuid: 'conn-002',
      name: 'DA-LD-IP-500M',
      type: 'IP_VC',
      state: 'ACTIVE',
      bandwidth: 500,
      aSide: {
        accessPoint: {
          type: 'CLOUD_ROUTER',
          router: { uuid: 'router-da1-001' },
          location: { metroCode: 'DA' },
        },
      },
      zSide: {
        accessPoint: {
          type: 'CLOUD_ROUTER',
          router: { uuid: 'router-ld5-001' },
          location: { metroCode: 'LD' },
        },
      },
    },
    // SG to DA — EVPL_VC via ports
    {
      uuid: 'conn-003',
      name: 'SG-DA-EVPL-100M',
      type: 'EVPL_VC',
      state: 'ACTIVE',
      bandwidth: 100,
      aSide: {
        accessPoint: {
          type: 'COLO',
          port: { uuid: 'port-sg1-001' },
          location: { metroCode: 'SG' },
        },
      },
      zSide: {
        accessPoint: {
          type: 'COLO',
          port: { uuid: 'port-da1-001' },
          location: { metroCode: 'DA' },
        },
      },
    },
    // Deprovisioned connection (should be filtered out)
    {
      uuid: 'conn-old',
      name: 'OLD-Connection',
      type: 'EVPL_VC',
      state: 'DEPROVISIONED',
      bandwidth: 50,
      aSide: {
        accessPoint: {
          type: 'COLO',
          port: { uuid: 'port-da1-old' },
          location: { metroCode: 'DA' },
        },
      },
      zSide: {
        accessPoint: {
          type: 'COLO',
          port: { uuid: 'port-sv5-001' },
          location: { metroCode: 'SV' },
        },
      },
    },
  ];
}
```

- [ ] **Step 4: Add import for new types at top of fabricMock.ts**

Add to the imports at the top of `src/api/mock/fabricMock.ts`:

```typescript
import type { PortResponse, ConnectionResponse, RouterResponse } from '@/types/equinix';
```

- [ ] **Step 5: Add mockDevices to networkEdgeMock.ts**

Append after line 151 in `src/api/mock/networkEdgeMock.ts`:

```typescript
export function mockDevices(): DeviceResponse[] {
  return [
    {
      uuid: 'device-da1-001',
      name: 'DA1-CSR1000v',
      status: 'PROVISIONED',
      metroCode: 'DA',
      deviceTypeCode: 'CSR1000V',
      vendorName: 'Cisco',
      packageCode: 'SEC',
      coreCount: 4,
      softwareVersion: '17.3.4a',
      licenseType: 'SUBSCRIPTION',
      redundant: false,
      termLength: 12,
    },
    {
      uuid: 'device-sv5-001',
      name: 'SV5-PA-VM-300',
      status: 'PROVISIONED',
      metroCode: 'SV',
      deviceTypeCode: 'PA-VM',
      vendorName: 'Palo Alto',
      packageCode: 'VM-300',
      coreCount: 4,
      softwareVersion: '10.2.3',
      licenseType: 'BYOL',
      redundant: true,
      termLength: 24,
    },
    {
      uuid: 'device-ld5-001',
      name: 'LD5-VSRX',
      status: 'PROVISIONED',
      metroCode: 'LD',
      deviceTypeCode: 'VSRX',
      vendorName: 'Juniper',
      packageCode: 'STD',
      coreCount: 2,
      softwareVersion: '21.4R1',
      licenseType: 'SUBSCRIPTION',
      redundant: false,
      termLength: 12,
    },
    // Deprovisioned (should be filtered)
    {
      uuid: 'device-old',
      name: 'OLD-Device',
      status: 'DEPROVISIONED',
      metroCode: 'DA',
      deviceTypeCode: 'CSR1000V',
      vendorName: 'Cisco',
      packageCode: 'SEC',
      coreCount: 2,
      softwareVersion: '17.3.4a',
      licenseType: 'SUBSCRIPTION',
      redundant: false,
      termLength: 12,
    },
  ];
}
```

- [ ] **Step 6: Add import for DeviceResponse at top of networkEdgeMock.ts**

```typescript
import type { DeviceResponse } from '@/types/equinix';
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 8: Commit**

```bash
git add equinix-pricing-tool/src/api/mock/fabricMock.ts equinix-pricing-tool/src/api/mock/networkEdgeMock.ts
git commit -m "feat(mock): add mock ports, connections, routers, and devices for environment import"
```

---

## Task 4: API Fetch Functions

**Files:**
- Modify: `src/api/fabric.ts:84` (append fetchPorts, fetchConnections, fetchRouters)
- Modify: `src/api/networkEdge.ts:52` (append fetchDevices)

- [ ] **Step 1: Write failing tests for fetchPorts**

Add to the end of `src/api/fabric.test.ts`:

```typescript
import { fetchPorts, fetchConnections, fetchRouters } from './fabric';

describe('fetchPorts', () => {
  it('returns mock ports when in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const ports = await fetchPorts();
    expect(ports.length).toBeGreaterThan(0);
    expect(ports[0]).toHaveProperty('uuid');
    expect(ports[0]).toHaveProperty('location');
  });

  it('calls API with pagination when not in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      pagination: { offset: 0, limit: 100, total: 1 },
      data: [{ uuid: 'p1', name: 'Port1', state: 'ACTIVE', location: { metroCode: 'DA', metroName: 'Dallas' }, encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: 10000, physicalPortQuantity: 1, redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' } }],
    });

    const ports = await fetchPorts();
    expect(apiRequest).toHaveBeenCalledWith('/fabric/v4/ports?offset=0&limit=100');
    expect(ports).toHaveLength(1);
    expect(ports[0].uuid).toBe('p1');
  });

  it('handles multiple pages', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (apiRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        pagination: { offset: 0, limit: 1, total: 2 },
        data: [{ uuid: 'p1', name: 'Port1', state: 'ACTIVE', location: { metroCode: 'DA', metroName: 'Dallas' }, encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: 10000, physicalPortQuantity: 1, redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' } }],
      })
      .mockResolvedValueOnce({
        pagination: { offset: 1, limit: 1, total: 2 },
        data: [{ uuid: 'p2', name: 'Port2', state: 'ACTIVE', location: { metroCode: 'SV', metroName: 'Silicon Valley' }, encapsulation: { type: 'QINQ' }, physicalPortSpeed: 1000, physicalPortQuantity: 1, redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' } }],
      });

    const ports = await fetchPorts();
    expect(ports).toHaveLength(2);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/api/fabric.test.ts --reporter=verbose`
Expected: FAIL — `fetchPorts` is not exported from `./fabric`

- [ ] **Step 3: Implement fetchPorts, fetchConnections, fetchRouters in fabric.ts**

Add to the imports at top of `src/api/fabric.ts` (line 3):

```typescript
import type { MetrosResponse, Metro, PriceSearchResponse, ServiceProfile, RouterPackage, PortResponse, ConnectionResponse, RouterResponse, PaginatedResponse } from '@/types/equinix';
```

Add new import from mock (line 5):

```typescript
import { mockMetros, mockPriceSearch, mockServiceProfiles, mockRouterPackages, mockPorts, mockConnections, mockRouters } from './mock/fabricMock';
```

Append after line 84:

```typescript
async function fetchAllPages<T>(basePath: string, limit = 100): Promise<T[]> {
  const allItems: T[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const response = await apiRequest<PaginatedResponse<T>>(
      `${basePath}?offset=${offset}&limit=${limit}`
    );
    allItems.push(...response.data);
    total = response.pagination.total;
    offset += response.data.length;
  }
  return allItems;
}

export async function fetchPorts(): Promise<PortResponse[]> {
  if (useMockData()) return mockPorts();
  return fetchAllPages<PortResponse>('/fabric/v4/ports');
}

export async function fetchConnections(): Promise<ConnectionResponse[]> {
  if (useMockData()) return mockConnections();
  return fetchAllPages<ConnectionResponse>('/fabric/v4/connections');
}

export async function fetchRouters(): Promise<RouterResponse[]> {
  if (useMockData()) return mockRouters();
  return fetchAllPages<RouterResponse>('/fabric/v4/routers');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd equinix-pricing-tool && npx vitest run src/api/fabric.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Write failing tests for fetchConnections and fetchRouters**

Add to `src/api/fabric.test.ts`:

```typescript
describe('fetchConnections', () => {
  it('returns mock connections when in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const conns = await fetchConnections();
    expect(conns.length).toBeGreaterThan(0);
    expect(conns[0]).toHaveProperty('uuid');
    expect(conns[0]).toHaveProperty('aSide');
    expect(conns[0]).toHaveProperty('zSide');
  });

  it('calls connections API when not in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      pagination: { offset: 0, limit: 100, total: 1 },
      data: [{ uuid: 'c1', name: 'Conn1', type: 'EVPL_VC', state: 'ACTIVE', bandwidth: 1000, aSide: { accessPoint: { type: 'COLO' } }, zSide: { accessPoint: { type: 'COLO' } } }],
    });

    const conns = await fetchConnections();
    expect(apiRequest).toHaveBeenCalledWith('/fabric/v4/connections?offset=0&limit=100');
    expect(conns).toHaveLength(1);
  });
});

describe('fetchRouters', () => {
  it('returns mock routers when in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const routers = await fetchRouters();
    expect(routers.length).toBeGreaterThan(0);
    expect(routers[0]).toHaveProperty('uuid');
    expect(routers[0]).toHaveProperty('package');
  });

  it('calls routers API when not in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      pagination: { offset: 0, limit: 100, total: 1 },
      data: [{ uuid: 'r1', name: 'Router1', state: 'PROVISIONED', location: { metroCode: 'DA', metroName: 'Dallas' }, package: { code: 'STANDARD' } }],
    });

    const routers = await fetchRouters();
    expect(apiRequest).toHaveBeenCalledWith('/fabric/v4/routers?offset=0&limit=100');
    expect(routers).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd equinix-pricing-tool && npx vitest run src/api/fabric.test.ts --reporter=verbose`
Expected: All tests PASS (implementation already added in step 3)

- [ ] **Step 7: Write failing test for fetchDevices**

Add to `src/api/networkEdge.test.ts`:

```typescript
import { fetchDevices } from './networkEdge';

describe('fetchDevices', () => {
  it('returns mock devices when in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const devices = await fetchDevices();
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0]).toHaveProperty('uuid');
    expect(devices[0]).toHaveProperty('deviceTypeCode');
  });

  it('calls devices API with pagination when not in mock mode', async () => {
    (useMockData as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      pagination: { offset: 0, limit: 100, total: 1 },
      data: [{ uuid: 'd1', name: 'Device1', status: 'PROVISIONED', metroCode: 'DA', deviceTypeCode: 'CSR1000V', vendorName: 'Cisco', packageCode: 'SEC', coreCount: 4, softwareVersion: '17.3', licenseType: 'SUBSCRIPTION', redundant: false, termLength: 12 }],
    });

    const devices = await fetchDevices();
    expect(apiRequest).toHaveBeenCalledWith('/ne/v1/devices?offset=0&limit=100');
    expect(devices).toHaveLength(1);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/api/networkEdge.test.ts --reporter=verbose`
Expected: FAIL — `fetchDevices` is not exported

- [ ] **Step 9: Implement fetchDevices in networkEdge.ts**

Add to imports at top of `src/api/networkEdge.ts` (line 3):

```typescript
import type { DeviceType, NetworkEdgePriceResponse, DeviceResponse, PaginatedResponse } from '@/types/equinix';
```

Add to mock import (line 5):

```typescript
import { mockDeviceTypes, mockNetworkEdgePricing, mockDevices } from './mock/networkEdgeMock';
```

Append after line 51:

```typescript
export async function fetchDevices(): Promise<DeviceResponse[]> {
  if (useMockData()) return mockDevices();

  const allDevices: DeviceResponse[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const response = await apiRequest<PaginatedResponse<DeviceResponse>>(
      `/ne/v1/devices?offset=${offset}&limit=100`
    );
    allDevices.push(...response.data);
    total = response.pagination.total;
    offset += response.data.length;
  }
  return allDevices;
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd equinix-pricing-tool && npx vitest run src/api/networkEdge.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add equinix-pricing-tool/src/api/fabric.ts equinix-pricing-tool/src/api/fabric.test.ts equinix-pricing-tool/src/api/networkEdge.ts equinix-pricing-tool/src/api/networkEdge.test.ts
git commit -m "feat(api): add fetchPorts, fetchConnections, fetchRouters, fetchDevices with pagination"
```

---

## Task 5: Environment Mapper

**Files:**
- Create: `src/utils/environmentMapper.ts`
- Create: `src/utils/environmentMapper.test.ts`

- [ ] **Step 1: Write failing tests for mapPortToService**

Create `src/utils/environmentMapper.test.ts`:

```typescript
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
      uuid: 'p1',
      name: 'SV5-1G',
      type: 'XF_PORT',
      state: 'ACTIVE',
      location: { metroCode: 'SV', metroName: 'Silicon Valley' },
      encapsulation: { type: 'QINQ' },
      physicalPortSpeed: 1000,
      physicalPortQuantity: 1,
      redundancy: { enabled: false, group: '' },
      account: { orgId: 'org1' },
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
    // sourceId should reference the first port in the group
    expect(services[0].sourceId).toBe('p1');
  });

  it('maps 10000 Mbps to 10G speed string', () => {
    const port: PortResponse = {
      uuid: 'p1', name: 'P1', type: 'XF_PORT', state: 'ACTIVE',
      location: { metroCode: 'DA', metroName: 'Dallas' },
      encapsulation: { type: 'DOT1Q' }, physicalPortSpeed: 10000, physicalPortQuantity: 1,
      redundancy: { enabled: false, group: '' }, account: { orgId: 'org1' },
    };

    const services = mapPortsToServices([port]);
    const config = services[0].config as { speed: string };
    expect(config.speed).toBe('10G');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/environmentMapper.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement environmentMapper.ts**

Create `src/utils/environmentMapper.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import type {
  PortResponse,
  ConnectionResponse,
  RouterResponse,
  DeviceResponse,
  Metro,
} from '@/types/equinix';
import type {
  ServiceSelection,
  FabricPortConfig,
  CloudRouterConfig,
  NetworkEdgeConfig,
  VirtualConnection,
  ConnectionEndpoint,
  EnvironmentInventory,
  EnvironmentInventoryMetro,
  PortSpeed,
} from '@/types/config';

function speedMbpsToLabel(mbps: number): PortSpeed {
  if (mbps >= 400000) return '400G';
  if (mbps >= 100000) return '100G';
  if (mbps >= 10000) return '10G';
  return '1G';
}

/**
 * Maps raw API ports to ServiceSelection objects.
 * Groups redundant port pairs (same redundancy.group) into a single REDUNDANT service.
 */
export function mapPortsToServices(ports: PortResponse[]): ServiceSelection[] {
  const services: ServiceSelection[] = [];
  const processedGroups = new Set<string>();

  for (const port of ports) {
    // Skip if part of a redundancy group we already processed
    if (port.redundancy.enabled && port.redundancy.group) {
      if (processedGroups.has(port.redundancy.group)) continue;
      processedGroups.add(port.redundancy.group);
    }

    const isRedundant = port.redundancy.enabled && port.redundancy.group !== '';
    const config: FabricPortConfig = {
      speed: speedMbpsToLabel(port.physicalPortSpeed),
      portProduct: 'STANDARD',
      type: isRedundant ? 'REDUNDANT' : 'PRIMARY',
      encapsulation: port.encapsulation.type,
      quantity: 1,
    };

    services.push({
      id: uuidv4(),
      type: 'FABRIC_PORT',
      config,
      pricing: null,
      isExisting: true,
      sourceId: port.uuid,
    });
  }

  return services;
}

export function mapRouterToService(router: RouterResponse): ServiceSelection {
  const config: CloudRouterConfig = {
    package: router.package.code,
  };

  return {
    id: uuidv4(),
    type: 'CLOUD_ROUTER',
    config,
    pricing: null,
    isExisting: true,
    sourceId: router.uuid,
  };
}

export function mapDeviceToService(device: DeviceResponse): ServiceSelection {
  const config: NetworkEdgeConfig = {
    deviceTypeCode: device.deviceTypeCode,
    deviceTypeName: device.name,
    vendorName: device.vendorName,
    packageCode: device.packageCode,
    coreMemory: `${device.coreCount} Cores`,
    softwareVersion: device.softwareVersion,
    licenseType: device.licenseType === 'BYOL' ? 'BYOL' : 'SUBSCRIPTION',
    redundant: device.redundant,
    termLength: device.termLength as 1 | 12 | 24 | 36,
  };

  return {
    id: uuidv4(),
    type: 'NETWORK_EDGE',
    config,
    pricing: null,
    isExisting: true,
    sourceId: device.uuid,
  };
}

function resolveEndpoint(
  accessPoint: ConnectionResponse['aSide']['accessPoint'],
  serviceIdMap: Map<string, string>
): ConnectionEndpoint {
  const metroCode = accessPoint.location?.metroCode ?? '';

  if (accessPoint.port?.uuid) {
    const serviceId = serviceIdMap.get(accessPoint.port.uuid) ?? '';
    return { metroCode, type: 'PORT', serviceId };
  }
  if (accessPoint.router?.uuid) {
    const serviceId = serviceIdMap.get(accessPoint.router.uuid) ?? '';
    return { metroCode, type: 'CLOUD_ROUTER', serviceId };
  }
  if (accessPoint.profile?.uuid) {
    return { metroCode, type: 'SERVICE_PROFILE', serviceId: '', serviceProfileName: accessPoint.profile.uuid };
  }

  return { metroCode, type: 'PORT', serviceId: '' };
}

export interface ConnectionMapResult {
  connection: VirtualConnection;
  warnings: string[];
}

export function mapConnectionToVC(
  conn: ConnectionResponse,
  serviceIdMap: Map<string, string>
): ConnectionMapResult {
  const warnings: string[] = [];
  const aSide = resolveEndpoint(conn.aSide.accessPoint, serviceIdMap);
  const zSide = resolveEndpoint(conn.zSide.accessPoint, serviceIdMap);

  if (aSide.serviceId === '') {
    warnings.push(`A-side endpoint references unimported resource (${conn.aSide.accessPoint.port?.uuid ?? conn.aSide.accessPoint.router?.uuid ?? 'unknown'})`);
  }
  if (zSide.serviceId === '') {
    warnings.push(`Z-side endpoint references unimported resource (${conn.zSide.accessPoint.port?.uuid ?? conn.zSide.accessPoint.router?.uuid ?? 'unknown'})`);
  }

  const connection: VirtualConnection = {
    id: uuidv4(),
    name: conn.name,
    type: conn.type,
    aSide,
    zSide,
    bandwidthMbps: conn.bandwidth,
    redundant: conn.redundancy?.priority === 'PRIMARY',
    pricing: null,
    showPriceTable: false,
    priceTable: null,
    isExisting: true,
    sourceId: conn.uuid,
  };

  return { connection, warnings };
}

export function buildInventory(
  ports: PortResponse[],
  connections: ConnectionResponse[],
  routers: RouterResponse[],
  devices: DeviceResponse[],
  metroLookup: Map<string, Metro>
): EnvironmentInventory {
  const metroMap = new Map<string, EnvironmentInventoryMetro>();

  function getOrCreateMetro(code: string, name: string): EnvironmentInventoryMetro {
    if (!metroMap.has(code)) {
      const metro = metroLookup.get(code);
      metroMap.set(code, {
        metroCode: code,
        metroName: name || metro?.name || code,
        region: (metro?.region ?? 'AMER') as 'AMER' | 'EMEA' | 'APAC',
        portCount: 0,
        connectionCount: 0,
        routerCount: 0,
        deviceCount: 0,
      });
    }
    return metroMap.get(code)!;
  }

  for (const port of ports) {
    getOrCreateMetro(port.location.metroCode, port.location.metroName).portCount++;
  }
  for (const conn of connections) {
    const aMetro = conn.aSide.accessPoint.location?.metroCode;
    const zMetro = conn.zSide.accessPoint.location?.metroCode;
    if (aMetro) getOrCreateMetro(aMetro, '').connectionCount++;
    if (zMetro && zMetro !== aMetro) getOrCreateMetro(zMetro, '').connectionCount++;
  }
  for (const router of routers) {
    getOrCreateMetro(router.location.metroCode, router.location.metroName).routerCount++;
  }
  for (const device of devices) {
    getOrCreateMetro(device.metroCode, '').deviceCount++;
  }

  const metros = Array.from(metroMap.values()).sort((a, b) => a.metroCode.localeCompare(b.metroCode));

  return {
    metros,
    totalPorts: ports.length,
    totalConnections: connections.length,
    totalRouters: routers.length,
    totalDevices: devices.length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/environmentMapper.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Add remaining tests for mapRouterToService, mapDeviceToService, mapConnectionToVC, buildInventory**

Append to `src/utils/environmentMapper.test.ts`:

```typescript
describe('mapRouterToService', () => {
  it('maps a router to CLOUD_ROUTER service', () => {
    const router: RouterResponse = {
      uuid: 'r1',
      name: 'FCR-Standard',
      state: 'PROVISIONED',
      location: { metroCode: 'DA', metroName: 'Dallas' },
      package: { code: 'STANDARD' },
    };

    const service = mapRouterToService(router);
    expect(service.type).toBe('CLOUD_ROUTER');
    expect(service.isExisting).toBe(true);
    expect(service.sourceId).toBe('r1');
    const config = service.config as { package: string };
    expect(config.package).toBe('STANDARD');
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
    const connections: ConnectionResponse[] = [];
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

    const inventory = buildInventory(ports, connections, routers, devices, metroLookup);
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
});
```

- [ ] **Step 6: Run all mapper tests**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/environmentMapper.test.ts --reporter=verbose`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add equinix-pricing-tool/src/utils/environmentMapper.ts equinix-pricing-tool/src/utils/environmentMapper.test.ts
git commit -m "feat(mapper): add environment resource mappers with tests"
```

---

## Task 6: Orchestrator Hook

**Files:**
- Create: `src/hooks/useEnvironmentImport.ts`
- Create: `src/hooks/useEnvironmentImport.test.ts`

- [ ] **Step 1: Write failing test for useEnvironmentImport**

Create `src/hooks/useEnvironmentImport.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigStore } from '@/store/configStore';

vi.mock('@/api/fabric', () => ({
  fetchPorts: vi.fn(),
  fetchConnections: vi.fn(),
  fetchRouters: vi.fn(),
  fetchMetros: vi.fn(),
}));

vi.mock('@/api/networkEdge', () => ({
  fetchDevices: vi.fn(),
}));

import { useEnvironmentImport } from './useEnvironmentImport';
import { fetchPorts, fetchConnections, fetchRouters, fetchMetros } from '@/api/fabric';
import { fetchDevices } from '@/api/networkEdge';
import { mockPorts, mockRouters, mockConnections } from '@/api/mock/fabricMock';
import { mockDevices } from '@/api/mock/networkEdgeMock';

describe('useEnvironmentImport', () => {
  beforeEach(() => {
    useConfigStore.getState().loadProject({
      id: 'test',
      name: 'Test',
      metros: [],
      connections: [],
      textBoxes: [],
      localSites: [],
      annotationMarkers: [],
      networks: [],
    });
    vi.clearAllMocks();
  });

  it('starts in idle phase', () => {
    const { result } = renderHook(() => useEnvironmentImport());
    expect(result.current.phase).toBe('idle');
    expect(result.current.inventory).toBeNull();
  });

  it('fetches inventory and transitions to selecting', async () => {
    const ports = mockPorts().filter((p) => p.state === 'ACTIVE');
    const routers = mockRouters();
    const conns = mockConnections().filter((c) => c.state === 'ACTIVE');
    const devices = mockDevices().filter((d) => d.status === 'PROVISIONED');

    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue(ports);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue(conns);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue(routers);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue(devices);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([
      { code: 'DA', name: 'Dallas', region: 'AMER', connectedMetros: [] },
      { code: 'SV', name: 'Silicon Valley', region: 'AMER', connectedMetros: [] },
      { code: 'LD', name: 'London', region: 'EMEA', connectedMetros: [] },
      { code: 'SG', name: 'Singapore', region: 'APAC', connectedMetros: [] },
    ]);

    const { result } = renderHook(() => useEnvironmentImport());

    await act(async () => {
      await result.current.fetchInventory();
    });

    expect(result.current.phase).toBe('selecting');
    expect(result.current.inventory).not.toBeNull();
    expect(result.current.inventory!.metros.length).toBeGreaterThan(0);
    expect(result.current.inventory!.totalPorts).toBeGreaterThan(0);
  });

  it('can toggle metro selection', async () => {
    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { result } = renderHook(() => useEnvironmentImport());

    await act(async () => {
      await result.current.fetchInventory();
    });

    act(() => {
      result.current.toggleMetro('DA');
    });
    expect(result.current.selectedMetros).toContain('DA');

    act(() => {
      result.current.toggleMetro('DA');
    });
    expect(result.current.selectedMetros).not.toContain('DA');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/hooks/useEnvironmentImport.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useEnvironmentImport.ts**

Create `src/hooks/useEnvironmentImport.ts`:

```typescript
import { useState, useCallback, useRef } from 'react';
import { useConfigStore } from '@/store/configStore';
import { fetchPorts, fetchConnections, fetchRouters, fetchMetros } from '@/api/fabric';
import { fetchDevices } from '@/api/networkEdge';
import {
  mapPortsToServices,
  mapRouterToService,
  mapDeviceToService,
  mapConnectionToVC,
  buildInventory,
} from '@/utils/environmentMapper';
import type {
  PortResponse,
  ConnectionResponse,
  RouterResponse,
  DeviceResponse,
} from '@/types/equinix';
import type { EnvironmentInventory } from '@/types/config';

type ImportPhase = 'idle' | 'fetching-inventory' | 'selecting' | 'importing' | 'complete' | 'error';

interface ImportProgress {
  [metroCode: string]: 'pending' | 'importing' | 'done' | 'error';
}

export function useEnvironmentImport() {
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [inventory, setInventory] = useState<EnvironmentInventory | null>(null);
  const [selectedMetros, setSelectedMetros] = useState<string[]>([]);
  const [progress, setProgress] = useState<ImportProgress>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState({ services: 0, connections: 0, metros: 0 });

  // Store raw API data between phases
  const rawData = useRef<{
    ports: PortResponse[];
    connections: ConnectionResponse[];
    routers: RouterResponse[];
    devices: DeviceResponse[];
  }>({ ports: [], connections: [], routers: [], devices: [] });

  const fetchInventory = useCallback(async () => {
    setPhase('fetching-inventory');
    setErrors([]);

    try {
      const [ports, connections, routers, devices, metros] = await Promise.all([
        fetchPorts(),
        fetchConnections(),
        fetchRouters(),
        fetchDevices(),
        fetchMetros(),
      ]);

      // Filter to active/provisioned only
      const activePorts = ports.filter((p) => p.state === 'ACTIVE');
      const activeConns = connections.filter((c) => c.state === 'ACTIVE');
      const activeRouters = routers.filter((r) => r.state === 'PROVISIONED');
      const activeDevices = devices.filter((d) => d.status === 'PROVISIONED');

      rawData.current = {
        ports: activePorts,
        connections: activeConns,
        routers: activeRouters,
        devices: activeDevices,
      };

      const metroLookup = new Map(metros.map((m) => [m.code, m]));
      const inv = buildInventory(activePorts, activeConns, activeRouters, activeDevices, metroLookup);
      setInventory(inv);
      setPhase('selecting');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to fetch environment']);
      setPhase('error');
    }
  }, []);

  const toggleMetro = useCallback((metroCode: string) => {
    setSelectedMetros((prev) =>
      prev.includes(metroCode)
        ? prev.filter((c) => c !== metroCode)
        : [...prev, metroCode]
    );
  }, []);

  const selectAll = useCallback(() => {
    if (inventory) {
      setSelectedMetros(inventory.metros.map((m) => m.metroCode));
    }
  }, [inventory]);

  const deselectAll = useCallback(() => {
    setSelectedMetros([]);
  }, []);

  const importSelected = useCallback(async () => {
    setPhase('importing');
    const store = useConfigStore.getState();
    const selectedSet = new Set(selectedMetros);
    const warnings: string[] = [];

    // Track Equinix UUID → generated service ID
    const sourceIdMap = new Map<string, string>();

    // Initialize progress
    const initialProgress: ImportProgress = {};
    for (const metro of selectedMetros) {
      initialProgress[metro] = 'pending';
    }
    setProgress(initialProgress);

    let totalServices = 0;
    let totalConnections = 0;

    try {
      // Get metros list for addMetro
      const allMetros = store.cache.metros;
      const metroLookup = new Map(allMetros.map((m) => [m.code, m]));

      // Import services per metro
      for (const metroCode of selectedMetros) {
        setProgress((prev) => ({ ...prev, [metroCode]: 'importing' }));

        try {
          // Ensure metro is in the project
          const metro = metroLookup.get(metroCode);
          if (metro && !store.project.metros.some((m) => m.metroCode === metroCode)) {
            store.addMetro(metro);
          }

          // Map and add ports for this metro
          const metroPorts = rawData.current.ports.filter(
            (p) => p.location.metroCode === metroCode
          );
          const portServices = mapPortsToServices(metroPorts);
          for (const svc of portServices) {
            const serviceId = store.addService(metroCode, svc.type);
            store.updateServiceConfig(metroCode, serviceId, svc.config);
            // Update the service to set isExisting and sourceId
            useConfigStore.setState((state) => ({
              project: {
                ...state.project,
                metros: state.project.metros.map((m) =>
                  m.metroCode === metroCode
                    ? {
                        ...m,
                        services: m.services.map((s) =>
                          s.id === serviceId
                            ? { ...s, isExisting: true, sourceId: svc.sourceId }
                            : s
                        ),
                      }
                    : m
                ),
              },
            }));
            if (svc.sourceId) sourceIdMap.set(svc.sourceId, serviceId);
            // Also map all port UUIDs in redundancy group to this service ID
            for (const port of metroPorts) {
              if (port.redundancy.enabled && port.redundancy.group) {
                const groupPorts = metroPorts.filter(
                  (p) => p.redundancy.group === port.redundancy.group
                );
                for (const gp of groupPorts) {
                  sourceIdMap.set(gp.uuid, serviceId);
                }
              }
            }
            totalServices++;
          }

          // Map and add routers for this metro
          const metroRouters = rawData.current.routers.filter(
            (r) => r.location.metroCode === metroCode
          );
          for (const router of metroRouters) {
            const svc = mapRouterToService(router);
            const serviceId = store.addService(metroCode, svc.type);
            store.updateServiceConfig(metroCode, serviceId, svc.config);
            useConfigStore.setState((state) => ({
              project: {
                ...state.project,
                metros: state.project.metros.map((m) =>
                  m.metroCode === metroCode
                    ? {
                        ...m,
                        services: m.services.map((s) =>
                          s.id === serviceId
                            ? { ...s, isExisting: true, sourceId: svc.sourceId }
                            : s
                        ),
                      }
                    : m
                ),
              },
            }));
            if (svc.sourceId) sourceIdMap.set(svc.sourceId, serviceId);
            totalServices++;
          }

          // Map and add devices for this metro
          const metroDevices = rawData.current.devices.filter(
            (d) => d.metroCode === metroCode
          );
          for (const device of metroDevices) {
            const svc = mapDeviceToService(device);
            const serviceId = store.addService(metroCode, svc.type);
            store.updateServiceConfig(metroCode, serviceId, svc.config);
            useConfigStore.setState((state) => ({
              project: {
                ...state.project,
                metros: state.project.metros.map((m) =>
                  m.metroCode === metroCode
                    ? {
                        ...m,
                        services: m.services.map((s) =>
                          s.id === serviceId
                            ? { ...s, isExisting: true, sourceId: svc.sourceId }
                            : s
                        ),
                      }
                    : m
                ),
              },
            }));
            if (svc.sourceId) sourceIdMap.set(svc.sourceId, serviceId);
            totalServices++;
          }

          // Refresh store reference after mutations
          Object.assign(store, useConfigStore.getState());
          setProgress((prev) => ({ ...prev, [metroCode]: 'done' }));
        } catch (err) {
          setProgress((prev) => ({ ...prev, [metroCode]: 'error' }));
          warnings.push(`Failed to import metro ${metroCode}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Import connections that span selected metros
      for (const conn of rawData.current.connections) {
        const aMetro = conn.aSide.accessPoint.location?.metroCode;
        const zMetro = conn.zSide.accessPoint.location?.metroCode;

        // Only import if at least one side is in selected metros
        if ((aMetro && selectedSet.has(aMetro)) || (zMetro && selectedSet.has(zMetro))) {
          const result = mapConnectionToVC(conn, sourceIdMap);
          warnings.push(...result.warnings);
          store.addConnection(result.connection);
          totalConnections++;
        }
      }

      setImportSummary({ services: totalServices, connections: totalConnections, metros: selectedMetros.length });
      if (warnings.length > 0) setErrors(warnings);
      setPhase('complete');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Import failed']);
      setPhase('error');
    }
  }, [selectedMetros]);

  const reset = useCallback(() => {
    setPhase('idle');
    setInventory(null);
    setSelectedMetros([]);
    setProgress({});
    setErrors([]);
    setImportSummary({ services: 0, connections: 0, metros: 0 });
    rawData.current = { ports: [], connections: [], routers: [], devices: [] };
  }, []);

  return {
    phase,
    inventory,
    selectedMetros,
    progress,
    errors,
    importSummary,
    fetchInventory,
    toggleMetro,
    selectAll,
    deselectAll,
    importSelected,
    reset,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd equinix-pricing-tool && npx vitest run src/hooks/useEnvironmentImport.test.ts --reporter=verbose`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/hooks/useEnvironmentImport.ts equinix-pricing-tool/src/hooks/useEnvironmentImport.test.ts
git commit -m "feat(hooks): add useEnvironmentImport orchestrator hook"
```

---

## Task 7: Import Dialog Component

**Files:**
- Create: `src/components/import/EnvironmentImportDialog.tsx`
- Create: `src/components/import/ImportButton.tsx`

- [ ] **Step 1: Create EnvironmentImportDialog.tsx**

Create `src/components/import/EnvironmentImportDialog.tsx`:

```typescript
import { useEnvironmentImport } from '@/hooks/useEnvironmentImport';
import type { EnvironmentInventoryMetro } from '@/types/config';

const REGION_COLORS: Record<string, string> = {
  AMER: 'bg-blue-100 text-blue-800',
  EMEA: 'bg-green-100 text-green-800',
  APAC: 'bg-purple-100 text-purple-800',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EnvironmentImportDialog({ open, onClose }: Props) {
  const {
    phase,
    inventory,
    selectedMetros,
    progress,
    errors,
    importSummary,
    fetchInventory,
    toggleMetro,
    selectAll,
    deselectAll,
    importSelected,
    reset,
  } = useEnvironmentImport();

  if (!open) return null;

  const handleStart = async () => {
    await fetchInventory();
  };

  const handleImport = async () => {
    await importSelected();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Import Existing Environment</h2>
          {phase !== 'importing' && (
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto flex-1">
          {phase === 'idle' && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600 mb-4">
                Discover and import your existing Equinix ports, connections, cloud routers, and network edge devices.
              </p>
              <button
                onClick={handleStart}
                className="px-4 py-2 bg-equinix-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                Discover My Environment
              </button>
            </div>
          )}

          {phase === 'fetching-inventory' && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-equinix-green rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-600">Discovering your Equinix environment...</p>
            </div>
          )}

          {phase === 'selecting' && inventory && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Found <strong>{inventory.totalPorts}</strong> ports, <strong>{inventory.totalConnections}</strong> connections, <strong>{inventory.totalRouters}</strong> routers, <strong>{inventory.totalDevices}</strong> devices across <strong>{inventory.metros.length}</strong> metros
              </p>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={selectAll} className="text-[10px] text-blue-600 hover:underline">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAll} className="text-[10px] text-blue-600 hover:underline">Deselect All</button>
              </div>
              <div className="space-y-1">
                {inventory.metros.map((metro: EnvironmentInventoryMetro) => (
                  <label
                    key={metro.metroCode}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                      selectedMetros.includes(metro.metroCode) ? 'bg-green-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetros.includes(metro.metroCode)}
                      onChange={() => toggleMetro(metro.metroCode)}
                      className="rounded border-gray-300 text-equinix-green focus:ring-equinix-green"
                    />
                    <span className="text-xs font-medium text-gray-900 min-w-[24px]">{metro.metroCode}</span>
                    <span className="text-xs text-gray-600 flex-1">{metro.metroName}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${REGION_COLORS[metro.region] || ''}`}>
                      {metro.region}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {[
                        metro.portCount > 0 && `${metro.portCount}P`,
                        metro.connectionCount > 0 && `${metro.connectionCount}C`,
                        metro.routerCount > 0 && `${metro.routerCount}R`,
                        metro.deviceCount > 0 && `${metro.deviceCount}D`,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {phase === 'importing' && (
            <div className="space-y-1">
              {Object.entries(progress).map(([metro, status]) => (
                <div key={metro} className="flex items-center gap-2 px-2 py-1">
                  {status === 'pending' && <span className="w-4 h-4 rounded-full bg-gray-200" />}
                  {status === 'importing' && (
                    <div className="w-4 h-4 animate-spin border-2 border-gray-300 border-t-equinix-green rounded-full" />
                  )}
                  {status === 'done' && <span className="w-4 h-4 text-equinix-green">&#10003;</span>}
                  {status === 'error' && <span className="w-4 h-4 text-equinix-red">&#10007;</span>}
                  <span className="text-xs text-gray-700">{metro}</span>
                </div>
              ))}
            </div>
          )}

          {phase === 'complete' && (
            <div className="text-center py-6">
              <div className="text-equinix-green text-3xl mb-2">&#10003;</div>
              <p className="text-sm font-medium text-gray-900 mb-1">Import Complete</p>
              <p className="text-xs text-gray-500">
                Imported {importSummary.services} services and {importSummary.connections} connections across {importSummary.metros} metros
              </p>
              {errors.length > 0 && (
                <div className="mt-3 text-left bg-yellow-50 border border-yellow-200 rounded p-2">
                  <p className="text-[10px] font-medium text-yellow-800 mb-1">Warnings:</p>
                  {errors.map((err, i) => (
                    <p key={i} className="text-[10px] text-yellow-700">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'error' && (
            <div className="text-center py-6">
              <div className="text-equinix-red text-3xl mb-2">&#10007;</div>
              <p className="text-sm font-medium text-gray-900 mb-1">Import Failed</p>
              {errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">{err}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          {phase === 'selecting' && (
            <button
              onClick={handleImport}
              disabled={selectedMetros.length === 0}
              className="px-4 py-1.5 bg-equinix-black text-white text-xs font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Import {selectedMetros.length > 0 ? `${selectedMetros.length} Metro${selectedMetros.length > 1 ? 's' : ''}` : 'Selected'}
            </button>
          )}
          {phase === 'complete' && (
            <button
              onClick={handleClose}
              className="px-4 py-1.5 bg-equinix-black text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          )}
          {phase === 'error' && (
            <>
              <button onClick={handleClose} className="px-4 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleStart} className="px-4 py-1.5 bg-equinix-black text-white text-xs font-medium rounded-md hover:bg-gray-800">Retry</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ImportButton.tsx**

Create `src/components/import/ImportButton.tsx`:

```typescript
import { useConfigStore } from '@/store/configStore';

interface Props {
  onClick: () => void;
}

export function ImportButton({ onClick }: Props) {
  const isAuthenticated = useConfigStore((s) => s.auth.isAuthenticated);

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={onClick}
      title="Import existing Equinix environment"
      className="px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border bg-white border-gray-300 transition-colors hover:bg-gray-50 flex items-center gap-1"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Import
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add equinix-pricing-tool/src/components/import/EnvironmentImportDialog.tsx equinix-pricing-tool/src/components/import/ImportButton.tsx
git commit -m "feat(ui): add EnvironmentImportDialog and ImportButton components"
```

---

## Task 8: Diagram Styling for Existing Resources

**Files:**
- Modify: `src/components/diagram/ServiceNode.tsx:14-21` (ServiceNodeData interface)
- Modify: `src/components/diagram/ServiceNode.tsx:93-94` (border rendering)
- Modify: `src/components/diagram/CustomEdge.tsx:11-19` (CustomEdgeData interface)
- Modify: `src/components/diagram/CustomEdge.tsx:165-186` (edge rendering)

- [ ] **Step 1: Add isExisting to ServiceNodeData interface**

In `src/components/diagram/ServiceNode.tsx`, modify the `ServiceNodeData` interface (line 14):

```typescript
interface ServiceNodeData {
  serviceId: string;
  serviceType: string;
  config: Record<string, unknown>;
  pricing: PricingResult | null;
  showPricing: boolean;
  isExisting?: boolean;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Add existing visual treatment to ServiceNode render**

In the same file, modify the component to read `isExisting` from data (after line 34):

```typescript
  const { serviceType, config, pricing, showPricing, isExisting } = data as ServiceNodeData;
```

Replace the outer div on line 94:

```typescript
    <div
      className={`rounded-md overflow-hidden shadow-sm bg-white ${
        isExisting ? 'border-2 border-dashed' : 'border border-gray-200'
      }`}
      style={{
        width: '100%',
        height: '100%',
        ...(isExisting ? { borderColor: '#33A85C' } : {}),
      }}
    >
```

Add the EXISTING label just before the outer div (wrap in a fragment):

```typescript
  return (
    <>
      {isExisting && (
        <div
          className="absolute -top-4 left-0 text-[8px] font-bold tracking-wide"
          style={{ color: '#33A85C' }}
        >
          ● EXISTING
        </div>
      )}
      <div
        className={`rounded-md overflow-hidden shadow-sm bg-white ${
          isExisting ? 'border-2 border-dashed' : 'border border-gray-200'
        }`}
        style={{
          width: '100%',
          height: '100%',
          ...(isExisting ? { borderColor: '#33A85C' } : {}),
        }}
      >
```

Close the fragment at the end of the return statement (after all the existing Handle components and closing div):

```typescript
      </div>
    </>
  );
```

- [ ] **Step 3: Add isExisting to CustomEdgeData interface**

In `src/components/diagram/CustomEdge.tsx`, add to the interface (line 11):

```typescript
interface CustomEdgeData {
  connectionId?: string;
  labelLine1: string;
  labelLine2?: string;
  showPricing?: boolean;
  isSameMetro?: boolean;
  isRedundant?: boolean;
  isExisting?: boolean;
  [key: string]: unknown;
}
```

- [ ] **Step 4: Apply existing edge styling**

In the same file, after line 162 (`const canDelete = ...`), add:

```typescript
  const isExisting = edgeData.isExisting === true;
  const existingDashArray = isExisting ? '6,4' : undefined;
  const existingStrokeColor = isExisting ? '#33A85C' : strokeColor;
```

Then update the BaseEdge calls to use `existingStrokeColor` and merge `existingDashArray`:

For the non-redundant case (line 186), change to:

```typescript
        <BaseEdge id={id} path={edgePath} style={{ ...style, stroke: existingStrokeColor, strokeWidth: 1.5, strokeDasharray: existingDashArray }} markerEnd={markerEnd} />
```

For the redundant outer stroke (line 174), change to:

```typescript
          <BaseEdge id={id} path={edgePath} style={{ ...style, strokeWidth: 5, stroke: existingStrokeColor, pointerEvents: 'none' }} markerEnd={markerEnd} />
```

- [ ] **Step 5: Wire isExisting data through diagram layout**

In `src/utils/diagramLayout.ts`, at line 180, add `isExisting` to the service node data object:

```typescript
        data: {
          serviceId: service.id,
          metroCode: metro.metroCode,
          serviceType: service.type,
          config: service.config,
          pricing: service.pricing,
          showPricing,
          isExisting: service.isExisting ?? false,
        },
```

For connection edges, at line ~514 (where edge data is built with `connectionId`, `labelLine1`, etc.), add `isExisting`:

```typescript
      data: {
        connectionId: conn.id,
        labelLine1,
        labelLine2,
        showPricing,
        isSameMetro,
        isRedundant: conn.redundant,
        isExisting: conn.isExisting ?? false,
      },
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add equinix-pricing-tool/src/components/diagram/ServiceNode.tsx equinix-pricing-tool/src/components/diagram/CustomEdge.tsx equinix-pricing-tool/src/utils/diagramLayout.ts
git commit -m "feat(diagram): add green dashed border for existing services and connections"
```

---

## Task 9: Integrate Import into NetworkDiagram

**Files:**
- Modify: `src/components/diagram/NetworkDiagram.tsx:765-787` (toolbar area)

- [ ] **Step 1: Add imports at top of NetworkDiagram.tsx**

Add to the existing imports:

```typescript
import { EnvironmentImportDialog } from '@/components/import/EnvironmentImportDialog';
import { ImportButton } from '@/components/import/ImportButton';
```

- [ ] **Step 2: Add dialog state**

Inside the `NetworkDiagram` component function, add state:

```typescript
const [showImportDialog, setShowImportDialog] = useState(false);
```

- [ ] **Step 3: Add ImportButton to toolbar**

After the Undo button (after line 787), insert:

```typescript
        <ImportButton onClick={() => setShowImportDialog(true)} />
```

- [ ] **Step 4: Add EnvironmentImportDialog render**

At the end of the component's return JSX (before the closing fragment or wrapper div), add:

```typescript
      <EnvironmentImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
```

- [ ] **Step 5: Verify TypeScript compiles and dev server runs**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No new errors

Run: `cd equinix-pricing-tool && npm run dev` (briefly verify it starts)
Expected: Dev server starts without errors

- [ ] **Step 6: Commit**

```bash
git add equinix-pricing-tool/src/components/diagram/NetworkDiagram.tsx
git commit -m "feat(diagram): integrate ImportButton and EnvironmentImportDialog into toolbar"
```

---

## Task 10: Post-Login Toast

**Files:**
- Modify: `src/components/diagram/NetworkDiagram.tsx` (add toast logic)

- [ ] **Step 1: Add toast state and auto-dismiss effect**

Inside the `NetworkDiagram` component, add:

```typescript
const [showImportToast, setShowImportToast] = useState(false);
const isAuthenticated = useConfigStore((s) => s.auth.isAuthenticated);
const hasMetros = useConfigStore((s) => s.project.metros.length > 0);
const prevAuthRef = useRef(false);

// Show toast after login if project is empty
useEffect(() => {
  if (isAuthenticated && !prevAuthRef.current && !hasMetros) {
    setShowImportToast(true);
  }
  prevAuthRef.current = isAuthenticated;
}, [isAuthenticated, hasMetros]);

// Auto-dismiss toast when user starts working
useEffect(() => {
  if (hasMetros && showImportToast) {
    setShowImportToast(false);
  }
}, [hasMetros, showImportToast]);

// Auto-dismiss toast after 15 seconds
useEffect(() => {
  if (showImportToast) {
    const timer = setTimeout(() => setShowImportToast(false), 15000);
    return () => clearTimeout(timer);
  }
}, [showImportToast]);
```

- [ ] **Step 2: Add toast JSX**

Before the `EnvironmentImportDialog` in the return JSX, add:

```typescript
      {/* Post-login import toast */}
      {showImportToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <p className="text-xs text-gray-700">Import your existing Equinix environment?</p>
          <button
            onClick={() => {
              setShowImportToast(false);
              setShowImportDialog(true);
            }}
            className="px-3 py-1 bg-equinix-black text-white text-[10px] font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => setShowImportToast(false)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            &times;
          </button>
        </div>
      )}
```

- [ ] **Step 3: Auto-dismiss on tab change**

Add another effect to dismiss when the active tab changes:

```typescript
const activeTab = useConfigStore((s) => s.ui.activeTab);

useEffect(() => {
  if (showImportToast) {
    setShowImportToast(false);
  }
}, [activeTab]);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/components/diagram/NetworkDiagram.tsx
git commit -m "feat(ui): add post-login import toast with auto-dismiss"
```

---

## Task 11: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd equinix-pricing-tool && npx vitest run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript check**

Run: `cd equinix-pricing-tool && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `cd equinix-pricing-tool && npm run lint`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 4: Fix any failures**

If tests, types, or lint fail, fix the issues and re-run.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A equinix-pricing-tool/src/
git commit -m "fix: resolve test/lint issues from environment import feature"
```
