# Import Existing Environment — Design Spec

## Overview

Add the ability for authenticated users to import their existing Equinix environment (ports, connections, cloud routers, network edge devices) into the diagram. Imported resources are visually tagged as "existing" (green dashed border, Equinix annotation style) but remain fully editable, enabling presales architects to show "here's what you have today, here's what we're adding."

## Decisions

| Decision | Choice |
|----------|--------|
| Import scope | Ports, Connections, Cloud Routers, Network Edge devices (no Service Profiles) |
| Editability | Hybrid — tagged "existing" but fully editable |
| Entry points | Post-login toast + toolbar "Import" button |
| Discovery flow | Progressive — inventory summary first, selective metro import second |
| Visual style | Green dashed border (#33A85C) + "EXISTING" label above node |
| APIs | `/fabric/v4/ports`, `/fabric/v4/connections`, `/fabric/v4/routers`, `/ne/v1/devices` |
| Auth | Existing OAuth client credentials — no extra permissions needed |

## Architecture: Per-Resource API + Orchestrator

New API functions sit in the existing `fabric.ts` and `networkEdge.ts` files. A thin orchestrator hook coordinates the progressive flow. A mapper utility converts raw API responses to store-compatible types.

```
API Layer (fetch)  →  Mapper (transform)  →  Hook (orchestrate)  →  Store (persist)  →  UI (render)
```

## 1. API Layer

### New Functions

**`src/api/fabric.ts`:**
- `fetchPorts()` → `GET /fabric/v4/ports` — paginated, returns all provisioned ports
- `fetchConnections()` → `GET /fabric/v4/connections` — paginated, returns all virtual connections
- `fetchRouters()` → `GET /fabric/v4/routers` — paginated, returns all FCR instances

**`src/api/networkEdge.ts`:**
- `fetchDevices()` → `GET /ne/v1/devices` — paginated, returns all virtual appliances

Each function:
- Uses existing `apiRequest()` from `client.ts` (auth headers, retry, backoff)
- Has a mock counterpart for `VITE_USE_MOCK=true`
- Returns typed responses (new interfaces in `equinix.ts`)
- Handles pagination by looping until all pages fetched. Fabric v4 uses `offset`/`limit` query params with a `pagination.total` in the response — increment offset by limit until offset >= total. NE v1 uses `offset`/`limit` similarly. Default limit: 100 per page.

## 2. Type Definitions

### New API Response Types (`src/types/equinix.ts`)

```typescript
interface PortResponse {
  uuid: string
  name: string
  type: 'XF_PORT'
  state: 'ACTIVE' | 'PROVISIONING' | 'DEPROVISIONED'
  location: { metroCode: string; metroName: string }
  encapsulation: { type: 'DOT1Q' | 'QINQ' }
  physicalPortSpeed: number
  physicalPortQuantity: number
  redundancy: { enabled: boolean; group: string }
  account: { orgId: string }
}

interface ConnectionResponse {
  uuid: string
  name: string
  type: 'EVPL_VC' | 'IP_VC' | 'EVPLAN_VC' | 'EPLAN_VC' | 'EVPTREE_VC' | 'EPTREE_VC'
  state: 'ACTIVE' | 'PROVISIONING' | 'DEPROVISIONED'
  bandwidth: number
  aSide: { accessPoint: { type: string; port?: { uuid: string }; router?: { uuid: string }; profile?: { uuid: string }; location?: { metroCode: string } } }
  zSide: { accessPoint: { type: string; port?: { uuid: string }; router?: { uuid: string }; profile?: { uuid: string }; location?: { metroCode: string } } }
  redundancy?: { group: string; priority: 'PRIMARY' | 'SECONDARY' }
}

interface RouterResponse {
  uuid: string
  name: string
  state: 'PROVISIONED' | 'DEPROVISIONED'
  location: { metroCode: string; metroName: string }
  package: { code: 'STANDARD' | 'PREMIUM' }
  order?: { purchaseOrderNumber: string }
}

interface DeviceResponse {
  uuid: string
  name: string
  status: 'PROVISIONED' | 'DEPROVISIONED'
  metroCode: string
  deviceTypeCode: string
  vendorName: string
  packageCode: string
  coreCount: number
  softwareVersion: string
  licenseType: 'BYOL' | 'SUBSCRIPTION'
  redundant: boolean
  termLength: number
}
```

### Config Type Extensions (`src/types/config.ts`)

```typescript
// Add to ServiceSelection
isExisting?: boolean    // true = imported from live environment
sourceId?: string       // original Equinix UUID

// Add to VirtualConnection
isExisting?: boolean
sourceId?: string

// New type for inventory summary
interface EnvironmentInventory {
  metros: {
    metroCode: string
    metroName: string
    region: 'AMER' | 'EMEA' | 'APAC'
    portCount: number
    connectionCount: number
    routerCount: number
    deviceCount: number
  }[]
  totalPorts: number
  totalConnections: number
  totalRouters: number
  totalDevices: number
}
```

## 3. Resource Mapping (`src/utils/environmentMapper.ts`)

Converts raw API responses into store-compatible project config types.

### Mappers

- **`mapPortToService(port: PortResponse) → ServiceSelection`** — Creates `FABRIC_PORT` service. Speed from `physicalPortSpeed`, encapsulation from `encapsulation.type`. Redundant port pairs (matched by `redundancy.group`) are grouped into a single REDUNDANT-type service. Sets `isExisting: true`, `sourceId: port.uuid`.

- **`mapRouterToService(router: RouterResponse) → ServiceSelection`** — Creates `CLOUD_ROUTER` service. Package from `package.code`. Sets `isExisting: true`, `sourceId: router.uuid`.

- **`mapDeviceToService(device: DeviceResponse) → ServiceSelection`** — Creates `NETWORK_EDGE` service. Populates `deviceTypeCode`, `vendorName`, `packageCode`, core count mapped to `coreMemory` string, `licenseType`, `redundant`, `termLength`. Sets `isExisting: true`, `sourceId: device.uuid`.

- **`mapConnectionToVC(conn: ConnectionResponse, serviceIdMap: Map<string, string>) → VirtualConnection`** — Creates `VirtualConnection`. Type from `conn.type`, bandwidth from `conn.bandwidth`. Resolves A-side/Z-side endpoints using `serviceIdMap` (maps Equinix UUIDs → generated service IDs). Connections referencing unimported resources get a warning but are still imported with the endpoint marked as external. Sets `isExisting: true`, `sourceId: conn.uuid`.

- **`buildInventory(ports, connections, routers, devices) → EnvironmentInventory`** — Groups resources by metro code, produces summary counts.

### Filtering Rules

- Only import resources with state/status = ACTIVE or PROVISIONED
- Skip DEPROVISIONED, PROVISIONING, or failed resources
- Redundant port pairs grouped by `redundancy.group` UUID

## 4. Orchestrator Hook (`src/hooks/useEnvironmentImport.ts`)

### State

```typescript
{
  phase: 'idle' | 'fetching-inventory' | 'selecting' | 'importing' | 'complete' | 'error'
  inventory: EnvironmentInventory | null
  selectedMetros: string[]
  progress: { [metroCode: string]: 'pending' | 'importing' | 'done' | 'error' }
  errors: string[]
}
```

### Actions

- **`fetchInventory()`** — Calls all 4 fetch functions in parallel (`Promise.all`). Filters to ACTIVE/PROVISIONED. Runs `buildInventory()`. Transitions to `'selecting'`.

- **`toggleMetro(metroCode)`** — Toggles metro in/out of `selectedMetros`.

- **`selectAll()` / `deselectAll()`** — Bulk selection.

- **`importSelected()`** — For each selected metro, sequentially:
  1. Groups ports/routers/devices for that metro
  2. Calls `addMetro()` on store (if not already present)
  3. Runs mappers, calls `addService()` + `updateServiceConfig()` for each
  4. Builds `serviceIdMap` as services are created
  5. After all metros: maps connections spanning selected metros, calls `addConnection()` for each
  6. Transitions to `'complete'`

- **`reset()`** — Returns to `'idle'`, clears state.

### Conflict Handling

If a metro already exists in the project, imported services are added alongside existing manually-added services. No overwrites.

### Why Sequential Per-Metro

Store actions generate IDs needed for connection mapping. Sequential processing also enables natural progress reporting — each metro turns green as it completes.

## 5. UI Components

### `src/components/import/EnvironmentImportDialog.tsx`

Modal dialog with phases:

- **`fetching-inventory`** — Spinner: "Discovering your Equinix environment..."
- **`selecting`** — Metro inventory picker:
  - Header: "Found X ports, Y connections, Z routers, W devices across N metros"
  - Select All / Deselect All buttons
  - Scrollable metro list, each row: metro name + code + region badge + resource counts + checkbox
  - "Import Selected (N metros)" button
- **`importing`** — Per-metro progress rows (spinner → green check → red X) + overall progress bar. Dialog cannot be closed.
- **`complete`** — Summary: "Imported X services and Y connections across Z metros" + Close button
- **`error`** — Error message + Retry button

### `src/components/import/ImportButton.tsx`

Toolbar button that opens the dialog. Only visible when `isAuthenticated === true`.

### Post-Login Toast

- Non-intrusive toast at the bottom of the screen
- Appears after successful login if the project has no metros
- Text: "Import your existing Equinix environment?" with "Import" and "Dismiss" actions
- **Auto-dismisses** when the user adds a metro, switches tabs, or interacts with any metro/service UI
- Also dismissable via X button or after ~15 seconds timeout

### Diagram Styling Changes

**`src/components/diagram/ServiceNode.tsx`:**
- If `service.isExisting === true`: green dashed border (`2px dashed #33A85C`), green "● EXISTING" label above node
- If `service.isExisting === false` and project contains any imported services: red "● NEW" label above node
- If no imports in project: no labels (current behavior)

**`src/components/diagram/CustomEdge.tsx`:**
- Existing connections (`isExisting === true`): green dashed line style
- Same label logic as service nodes

## 6. Mock Data

### `src/api/mock/fabricMock.ts` — add:
- `mockPorts()` — ~10 ports across 4-5 metros (DA1, SV5, LD5, SG1). Mix of 1G/10G, DOT1Q/QINQ, some redundant pairs. All ACTIVE.
- `mockConnections()` — ~8 connections referencing mock ports/routers. Mix of EVPL_VC/IP_VC, various bandwidths, some cross-metro.
- `mockRouters()` — 2-3 FCR instances, STANDARD and PREMIUM packages.

### `src/api/mock/networkEdgeMock.ts` — add:
- `mockDevices()` — 3-4 devices. Cisco CSR, Palo Alto, etc. Mix of BYOL/SUBSCRIPTION, different core counts.

Mock data uses the same metro codes as existing `mockMetros()` for diagram alignment. Redundant pairs share `redundancy.group` UUIDs. Mock connections reference mock port/router UUIDs for end-to-end serviceIdMap testing.

## 7. Testing

### Unit Tests

**`src/utils/__tests__/environmentMapper.test.ts`:**
- `mapPortToService` — single port, redundant pair grouping, speed/encapsulation mapping
- `mapRouterToService` — standard/premium package mapping
- `mapDeviceToService` — core count, license type, term length mapping
- `mapConnectionToVC` — endpoint resolution via serviceIdMap, cross-metro, missing endpoint warnings
- `buildInventory` — groups by metro, correct counts, filters non-active
- All mappers set `isExisting: true` and `sourceId`

**`src/api/__tests__/fabricImport.test.ts`:**
- `fetchPorts`, `fetchConnections`, `fetchRouters` — pagination, error responses (403, 500), mock mode

**`src/api/__tests__/networkEdgeImport.test.ts`:**
- `fetchDevices` — pagination, errors, mock mode

### Integration Tests

**`src/hooks/__tests__/useEnvironmentImport.test.ts`:**
- Full flow: fetchInventory → select metros → importSelected
- Store state verification after import
- Conflict handling (importing into existing project)
- Partial metro selection (connections spanning unselected metros)
- Error recovery (one API fails, others succeed)

### Component Tests

**`src/components/import/__tests__/EnvironmentImportDialog.test.ts`:**
- Phase transitions render correct UI
- Metro selection/deselection
- Import button disabled until metros selected
- Progress indicators during import

**`src/components/diagram/__tests__/ServiceNode.existing.test.ts`:**
- `isExisting: true` renders green dashed border + EXISTING label
- `isExisting: false` with mixed project renders NEW label
- No labels when no imports present
