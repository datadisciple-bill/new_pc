# draw.io Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export React Flow network diagrams as `.drawio` XML files that LucidChart can import with full structural editability.

**Architecture:** A single pure utility module (`drawioExporter.ts`) generates draw.io XML from the Zustand project config + React Flow node/edge state. SVG icons are imported as raw strings via Vite's `?raw` suffix. A button inside `NetworkDiagram.tsx` (within the ReactFlow provider context) triggers the export.

**Tech Stack:** TypeScript, Vite `?raw` imports, template literals for XML generation, `@xyflow/react` Node/Edge types.

**Spec:** `docs/superpowers/specs/2026-03-23-drawio-export-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `equinix-pricing-tool/src/utils/drawioExporter.ts` | Create | All draw.io XML generation logic + download helper |
| `equinix-pricing-tool/src/utils/drawioExporter.test.ts` | Create | Unit tests for XML generation |
| `equinix-pricing-tool/src/components/diagram/NetworkDiagram.tsx` | Modify (lines 853-862) | Add "LucidChart" export button next to PNG button |

---

## Task 1: XML Skeleton + Download Helper

**Files:**
- Create: `equinix-pricing-tool/src/utils/drawioExporter.ts`
- Create: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

- [ ] **Step 1: Write the failing test for XML skeleton**

```ts
// drawioExporter.test.ts
import { describe, it, expect } from 'vitest';
import { generateDrawioXml } from './drawioExporter';
import type { ProjectConfig } from '@/types/config';
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal skeleton implementation**

```ts
// drawioExporter.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.ts equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "feat: draw.io exporter skeleton with XML structure and download helper"
```

---

## Task 2: Metro Group Nodes

**Files:**
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.ts`
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

**Context:** Metro nodes in React Flow have `type: 'metroNode'`, `id: 'metro-DC'`, `data: { metroCode, metroName, region }`, and `style: { width, height }`. Child service nodes have `parentId: 'metro-DC'`. Region colors: AMER `#3B82F6`, EMEA `#10B981`, APAC `#8B5CF6`. Metro background: `#F4F4F4`.

- [ ] **Step 1: Write failing test for metro group generation**

```ts
import type { MetroSelection } from '@/types/config';

const makeMetro = (code: string, region = 'AMER'): MetroSelection => ({
  metroCode: code,
  metroName: `Metro ${code}`,
  region,
  services: [],
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: FAIL — XML output doesn't contain metro group cells yet

- [ ] **Step 3: Implement metro group generation**

Add to `generateDrawioXml` after the root cells, before returning XML. The implementation should:

1. Define `REGION_COLORS: Record<string, string>` mapping `AMER` → `#3B82F6`, `EMEA` → `#10B981`, `APAC` → `#8B5CF6`.
2. Track a `nextId` counter starting at 2.
3. Track a `nodeIdMap: Map<string, number>` mapping React Flow node IDs to draw.io cell IDs.
4. Iterate `nodes` filtering for `type === 'metroNode'`. For each metro node:
   - Emit a group container cell: `<mxCell id="{nextId}" value="" style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>`
   - Store `nodeIdMap.set(node.id, nextId)`, increment `nextId`.
   - Emit a background rectangle child: fill `#F4F4F4`, `parent="{metroGroupId}"`, full width/height, `rounded=1`.
   - Emit a header bar child: fill region color, `parent="{metroGroupId}"`, full width, height 48, white bold text with metro name.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.ts equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "feat: draw.io export metro group nodes with region colors"
```

---

## Task 3: Service Nodes with Embedded SVG Icons

**Files:**
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.ts`
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

**Context:** Service nodes have `type: 'serviceNode'`, `parentId: 'metro-{code}'`, `data: { serviceId, serviceType, config }`. Style: black fill `#000000`, white text. 7 SVG icon files in `src/assets/icons/`. Import as raw strings with Vite `?raw` suffix.

- [ ] **Step 1: Write failing test for service node generation**

```ts
import type { ServiceSelection } from '@/types/config';

const makeService = (id: string, type: ServiceSelection['type']): ServiceSelection => ({
  id,
  type,
  config: type === 'FABRIC_PORT'
    ? { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 }
    : type === 'NETWORK_EDGE'
    ? { deviceTypeCode: 'CSR', deviceTypeName: 'Cisco', vendorName: 'Cisco', packageCode: 'STD', softwareVersion: '', licenseType: 'SUBSCRIPTION', redundant: false, termLength: 1 }
    : { package: 'STANDARD' } as any,
  pricing: null,
});

it('generates service node cells inside metro group', () => {
  const project = {
    ...emptyProject,
    metros: [{ ...makeMetro('DC'), services: [makeService('s1', 'FABRIC_PORT')] }],
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
      data: { serviceId: 's1', serviceType: 'FABRIC_PORT', config: makeService('s1', 'FABRIC_PORT').config },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: FAIL — no service nodes in output

- [ ] **Step 3: Implement service node generation with icon embedding**

Add to `drawioExporter.ts`:

1. Import all 11 SVG icons with `?raw` suffix:
   ```ts
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
   ```

2. Create lookup maps:
   ```ts
   const SERVICE_ICON_SVG: Record<string, string> = {
     FABRIC_PORT: fabricPortSvg,
     NETWORK_EDGE: networkEdgeSvg,
     INTERNET_ACCESS: internetAccessSvg,
     CLOUD_ROUTER: cloudRouterSvg,
     COLOCATION: colocationSvg,
     NSP: nspSvg,
     CROSS_CONNECT: crossConnectSvg,
   };

   const LOCAL_SITE_ICON_SVG: Record<string, string> = {
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
   ```

3. In the node iteration, after metros, handle `type === 'serviceNode'`:
   - Look up parent metro group ID from `nodeIdMap` using `node.parentId`.
   - Get service type label from `SERVICE_TYPE_LABELS` (import from `@/constants/brandColors`).
   - Encode icon: `const iconBase64 = btoa(SERVICE_ICON_SVG[data.serviceType] ?? '');`
   - Emit an image+label cell. The cell uses an HTML label with the icon image and service name text. Style: `rounded=1;fillColor=#000000;fontColor=#FFFFFF;fontSize=10;fontStyle=1;fontFamily=Arial;whiteSpace=wrap;` with the icon as a separate image child cell or embedded in the label.
   - The simpler approach: emit the service as a rounded rectangle with black fill and white text label, then emit a separate small image cell positioned inside it for the icon. Both cells share the metro group as parent.
   - Store `nodeIdMap.set(node.id, serviceId)`.

**Note for Vitest and `?raw` imports:** The project's `vitest.config.ts` uses `@vitejs/plugin-react` and Vite's transform pipeline, which should handle `?raw` suffix imports. However, if tests fail at import time (not assertion time), the fix is to mock the SVG imports in the test file:
```ts
vi.mock('@/assets/icons/fabric-port.svg?raw', () => ({ default: '<svg>mock</svg>' }));
// ... repeat for each icon
```
Or add a global mock in `src/test/setup.ts`. Verify `?raw` works before proceeding past this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.ts equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "feat: draw.io export service nodes with embedded SVG icons"
```

---

## Task 4: Cloud Nodes

**Files:**
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.ts`
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

**Context:** Cloud nodes have `type: 'cloudNode'`, `data: { provider, cloudRegion?, cloudMetro? }`. They are standalone (parent is "1"). The color is derived at export time by matching `data.provider` against `CLOUD_PROVIDER_COLORS` in `brandColors.ts` — same fuzzy-match logic as `CloudNode.tsx` (check if provider name contains the first word of the color map key, case-insensitive). Default fallback color: `#6B7280`.

- [ ] **Step 1: Write failing test for cloud nodes**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement cloud node generation**

In the node iteration, handle `type === 'cloudNode'`:
- Derive the fill color using the same fuzzy-match logic as `CloudNode.tsx`: iterate `CLOUD_PROVIDER_COLORS` entries, check if `data.provider.toLowerCase()` includes the first word of the key (lowercased). Fallback: `#6B7280`.
- Emit a rounded rectangle cell with `fillColor={derivedColor}`, `fontColor=#FFFFFF`, white text label = `data.provider`.
- Parent is "1" (root). Position from `node.position`.
- Store in `nodeIdMap`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.ts equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "feat: draw.io export cloud nodes with brand colors"
```

---

## Task 5: Floaty Nodes (TextBox, LocalSite, AnnotationMarker, AnnotationLegend, MultipointNetwork)

**Files:**
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.ts`
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

**Context:**
- `textBoxNode`: `data: { text }`, no fill/border, just text. Position from node.
- `localSiteNode`: `data: { localSiteId, name, description, icon }`. White fill, embedded SVG icon from `LOCAL_SITE_ICON_SVG` map. Position from node.
- `annotationMarkerNode`: `data: { markerId, number, color, text }`. Red circle (`#E91C24` default), white number label. Position from node.
- `annotationLegendNode`: `data: { markers: [{number, text, color}...] }`. White rectangle with text rows listing marker descriptions.
- `multipointNetworkNode`: `data: { networkId, name, type, scope }`. Rounded rectangle with color from `NETWORK_NODE_COLORS`. Position from node.

- [ ] **Step 1: Write failing tests for each floaty node type**

```ts
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
  // No fill, no stroke
  expect(xml).toMatch(/fillColor=none|fillColor=#none|noFill/i);
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
  // Note: marker text lives in ProjectConfig.annotationMarkers, not in node data.
  // The exporter should look up the text from config.annotationMarkers by matching markerId.
  const project = {
    ...emptyProject,
    annotationMarkers: [{ id: 'm1', number: 1, x: 50, y: 50, color: '#E91C24', text: 'Primary link' }],
  };
  const xml = generateDrawioXml(project, nodes, []);
  expect(xml).toContain('ellipse');
  expect(xml).toContain('#E91C24');
  expect(xml).toContain('>1<');
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
  expect(xml).toContain('#0067B8'); // EVPLAN color
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement floaty node dispatch**

In the node iteration, add a switch/dispatch for each floaty type:

- `textBoxNode`: `style="text;fillColor=none;strokeColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;fontFamily=Arial;fontSize=10;"`, value = `escapeXml(data.text)`.
- `localSiteNode`: Rounded rectangle with white fill. Emit icon as image child cell (same pattern as service nodes). Label = name + description.
- `annotationMarkerNode`: `style="ellipse;fillColor={data.color};fontColor=#FFFFFF;strokeColor=none;fontSize=12;fontStyle=1;fontFamily=Arial;"`, value = `data.number`, width/height = 28. Note: `data.text` is NOT available on the node — the text lives in `config.annotationMarkers`. The circle only shows the number.
- `annotationLegendNode`: Rectangle with white fill. `data.markers` is an array of `AnnotationMarker` objects (with `number`, `color`, `text`). Emit an HTML label listing each marker: `<b style="color:{color}">{number}</b> {text}` per row.
- `multipointNetworkNode`: Rounded rectangle with `fillColor={NETWORK_NODE_COLORS[data.type]}`, white text, label = `data.name`.

All floaty nodes use parent "1" and absolute positions from node.position.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.ts equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "feat: draw.io export text boxes, local sites, markers, networks"
```

---

## Task 6: Price Table Nodes

**Files:**
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.ts`
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

**Context:** Three price table node types use HTML table labels:
- `priceTableNode`: `data: { connectionName, selectedBandwidthMbps, priceTable: BandwidthPriceEntry[] }`
- `nePriceTableNode`: `data: { serviceName, selectedCores, priceTable: CorePriceEntry[], termLength }`
- `eiaPriceTableNode`: `data: { serviceName, priceTable: BandwidthPriceEntry[] }`

- [ ] **Step 1: Write failing test for VC price table**

```ts
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
  // HTML label
  expect(xml).toContain('<table');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement price table nodes**

For each price table type, emit a cell with `style="...;html=1;"` and an HTML table as the value:

```html
<table style="font-size:9px;font-family:Arial;">
  <tr><th colspan="2">{tableName}</th></tr>
  <tr><th>Bandwidth</th><th>MRC</th></tr>
  <tr><td>{label}</td><td>${mrc}</td></tr>
  ...
</table>
```

Highlight the selected row (bold or background color) based on `selectedBandwidthMbps` / `selectedCores`.

Handle all three table types: `priceTableNode`, `nePriceTableNode`, `eiaPriceTableNode` — each has slightly different data shapes but the same HTML table output pattern.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.ts equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "feat: draw.io export price table nodes as HTML tables"
```

---

## Task 7: Edges / Connectors

**Files:**
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.ts`
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

**Context:** Edges in React Flow have `id: 'edge-{connId}'`, `source`, `target`, `sourceHandle`, `targetHandle`, `style: { stroke, strokeWidth, strokeDasharray }`, `data: { labelLine1, labelLine2, isRedundant, isSameMetro }`.

Handle-side mapping: `left` → `exitX=0;exitY=0.5`, `right` → `exitX=1;exitY=0.5`, `top` → `exitX=0.5;exitY=0`, `bottom` → `exitX=0.5;exitY=1`. Handle IDs are like `right-source`, `left-target` — parse the side from the first segment.

- [ ] **Step 1: Write failing test for edge generation**

```ts
it('generates logical connector edge with correct style', () => {
  const nodes: Node[] = [
    {
      id: 'service-s1',
      type: 'serviceNode',
      position: { x: 16, y: 64 },
      parentId: 'metro-DC',
      data: { serviceId: 's1', serviceType: 'FABRIC_PORT' },
      style: { width: 204, height: 72 },
      width: 204,
      height: 72,
    },
    {
      id: 'service-s2',
      type: 'serviceNode',
      position: { x: 16, y: 64 },
      parentId: 'metro-SV',
      data: { serviceId: 's2', serviceType: 'NETWORK_EDGE' },
      style: { width: 204, height: 72 },
      width: 204,
      height: 72,
    },
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
      id: 'metro-SV',
      type: 'metroNode',
      position: { x: 600, y: 0 },
      data: { metroCode: 'SV', metroName: 'Metro SV', region: 'AMER' },
      style: { width: 472, height: 200 },
      width: 472,
      height: 200,
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
    metros: [makeMetro('DC'), makeMetro('SV')],
  };
  const xml = generateDrawioXml(project, nodes, edges);

  // Should be a connector (edge="1")
  expect(xml).toContain('edge="1"');
  // Should reference source and target
  expect(xml).toContain('source=');
  expect(xml).toContain('target=');
  // Should have stroke color
  expect(xml).toContain('#33A85C');
  // Should have label
  expect(xml).toContain('EVPL 1 Gbps');
  // Handle sides: right exit, left entry
  expect(xml).toContain('exitX=1');
  expect(xml).toContain('entryX=0');
});

it('generates two connectors for redundant edges', () => {
  const edges: Edge[] = [
    {
      id: 'edge-c2',
      source: 'service-s1',
      target: 'service-s2',
      sourceHandle: 'right-source',
      targetHandle: 'left-target',
      type: 'customEdge',
      style: { stroke: '#33A85C', strokeWidth: 1.5 },
      data: {
        connectionId: 'c2',
        labelLine1: 'Redundant EVPL',
        isRedundant: true,
        isSameMetro: false,
      },
    },
  ];
  // ...use same nodes from above...
  const xml = generateDrawioXml(emptyProject, nodes, edges);
  // Count edge="1" occurrences — should be 2 for redundant
  const edgeMatches = xml.match(/edge="1"/g);
  expect(edgeMatches?.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement edge generation**

After all node cells are generated, iterate `edges`:

1. Parse handle sides from `sourceHandle`/`targetHandle` (split on `-`, take first segment).
2. Map handle side to exit/entry coordinates:
   ```ts
   function handleToCoords(side: string): { x: number; y: number } {
     switch (side) {
       case 'left': return { x: 0, y: 0.5 };
       case 'right': return { x: 1, y: 0.5 };
       case 'top': return { x: 0.5, y: 0 };
       case 'bottom': return { x: 0.5, y: 1 };
       default: return { x: 0.5, y: 0.5 };
     }
   }
   ```
3. Look up source/target draw.io IDs from `nodeIdMap`.
4. Build style string: `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;strokeColor={color};strokeWidth=1.5;exitX={ex};exitY={ey};exitDx=0;exitDy=0;entryX={enx};entryY={eny};entryDx=0;entryDy=0;`
5. Add `dashed=1;dashPattern=8 4;` for IP_VC (strokeDasharray `8 4`) or `dashed=1;dashPattern=4 3;` for dotted network connections (strokeDasharray `4 3`).
6. Build label: combine `labelLine1` and `labelLine2` (if present) with `\n`.
7. Emit: `<mxCell id="{nextId}" value="{label}" style="{style}" edge="1" source="{srcId}" target="{tgtId}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`
8. For redundant edges (`data.isRedundant === true`): emit two connectors with the same source/target but offset entry/exit: first with `exitDy=-4;entryDy=-4`, second with `exitDy=4;entryDy=4`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.ts equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "feat: draw.io export edges as logical connectors with styles and labels"
```

---

## Task 8: UI Button in NetworkDiagram

**Files:**
- Modify: `equinix-pricing-tool/src/components/diagram/NetworkDiagram.tsx` (lines ~853-862, toolbar area)
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.ts` (no changes, just imported)

**Context:** The export button must be inside `NetworkDiagram.tsx` because it needs `useReactFlow()` context. The toolbar already has buttons for Text, Marker, Site, Network, PNG, and Legend — all using the same CSS classes. Place the new button right after the PNG button (line 862).

- [ ] **Step 1: Add LucidChart export button to toolbar**

In `NetworkDiagram.tsx`, after the PNG button (around line 862), add:

```tsx
import { generateDrawioXml, downloadDrawio } from '@/utils/drawioExporter';

// Inside the component, after handleExportPng:
const handleExportDrawio = useCallback(() => {
  const project = useConfigStore.getState().project;
  const xml = generateDrawioXml(project, reactFlowNodes, reactFlowEdges);
  downloadDrawio(xml, project.name);
}, [reactFlowNodes, reactFlowEdges]);
```

Button JSX (same style as PNG button):
```tsx
<button
  onClick={handleExportDrawio}
  title="Export diagram for LucidChart / draw.io editing"
  className="px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border bg-white border-gray-300 transition-colors hover:bg-gray-50 flex items-center gap-1"
>
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
  LucidChart
</button>
```

- [ ] **Step 2: Verify the app builds**

Run: `cd equinix-pricing-tool && npx vite build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run all existing tests to check for regressions**

Run: `cd equinix-pricing-tool && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add equinix-pricing-tool/src/components/diagram/NetworkDiagram.tsx
git commit -m "feat: add LucidChart/draw.io export button to diagram toolbar"
```

---

## Task 9: Integration Test — Full Diagram Export

**Files:**
- Modify: `equinix-pricing-tool/src/utils/drawioExporter.test.ts`

**Context:** Test the full pipeline with a realistic diagram containing metros, services, clouds, connections, text boxes, and markers — verifying the output is valid XML with all expected elements.

- [ ] **Step 1: Write integration test**

```ts
describe('generateDrawioXml integration', () => {
  it('exports a complete diagram with all node and edge types', () => {
    const project: ProjectConfig = {
      id: 'int-test',
      name: 'Integration Test',
      metros: [
        {
          metroCode: 'DC',
          metroName: 'Washington D.C.',
          region: 'AMER',
          services: [
            makeService('fp1', 'FABRIC_PORT'),
            makeService('ne1', 'NETWORK_EDGE'),
          ],
        },
        {
          metroCode: 'LN',
          metroName: 'London',
          region: 'EMEA',
          services: [makeService('cr1', 'CLOUD_ROUTER')],
        },
      ],
      connections: [
        {
          id: 'c1',
          name: 'DC-LN Link',
          type: 'EVPL_VC',
          aSide: { metroCode: 'DC', type: 'PORT', serviceId: 'fp1', handleSide: 'right' },
          zSide: { metroCode: 'LN', type: 'CLOUD_ROUTER', serviceId: 'cr1', handleSide: 'left' },
          bandwidthMbps: 1000,
          redundant: false,
          pricing: null,
          showPriceTable: false,
          priceTable: null,
        },
      ],
      textBoxes: [{ id: 't1', text: 'Note: primary link', x: 500, y: 500, width: 150, height: 40 }],
      localSites: [],
      annotationMarkers: [{ id: 'm1', number: 1, x: 50, y: 50, color: '#E91C24', text: 'Primary' }],
      networks: [],
    };

    // Build nodes/edges from layout (reuse the actual layout function)
    const { nodes, edges } = buildDiagramLayout(
      project.metros,
      project.connections,
      true,
      project.textBoxes,
      [],
      project.annotationMarkers,
      []
    );

    // Add a cloud node (these are added dynamically by buildDiagramLayout when zSide is SERVICE_PROFILE)
    nodes.push({
      id: 'cloud-aws-1',
      type: 'cloudNode',
      position: { x: 700, y: 100 },
      data: { provider: 'AWS Direct Connect', cloudRegion: 'us-east-1', cloudMetro: 'DC' },
      style: { width: 160, height: 50 },
      width: 160,
      height: 50,
    });

    const xml = generateDrawioXml(project, nodes, edges);

    // Valid XML structure
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<mxfile');
    expect(xml).toContain('Integration Test');

    // Both metros present
    expect(xml).toContain('Washington D.C.');
    expect(xml).toContain('London');

    // Services present
    expect(xml).toContain('Fabric Port');
    expect(xml).toContain('Network Edge');
    expect(xml).toContain('Fabric Cloud Router');

    // Cloud node
    expect(xml).toContain('AWS');
    expect(xml).toContain('#FF9900');

    // Edge present
    expect(xml).toContain('edge="1"');

    // Text box
    expect(xml).toContain('Note: primary link');

    // Annotation marker
    expect(xml).toContain('#E91C24');

    // Annotation legend (auto-generated by buildDiagramLayout when markers exist)
    expect(xml).toContain('Primary');

    // Region colors
    expect(xml).toContain('#3B82F6'); // AMER
    expect(xml).toContain('#10B981'); // EMEA
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `cd equinix-pricing-tool && npx vitest run src/utils/drawioExporter.test.ts`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `cd equinix-pricing-tool && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add equinix-pricing-tool/src/utils/drawioExporter.test.ts
git commit -m "test: integration test for full draw.io diagram export"
```

---

## Task 10: Manual Validation Checklist

This task has no code changes — it's a manual QA step.

- [ ] **Step 1: Start dev server and create a test diagram**

Run: `cd equinix-pricing-tool && npm run dev`

In the app:
1. Add 2 metros (different regions)
2. Add services to each (Fabric Port, Network Edge, Cloud Router)
3. Connect services with a virtual connection
4. Add a text box annotation
5. Add an annotation marker
6. Toggle pricing on

- [ ] **Step 2: Export to draw.io**

Click the "LucidChart" button in the diagram toolbar. Verify a `.drawio` file downloads.

- [ ] **Step 3: Open in diagrams.net**

Go to `app.diagrams.net`, drag and drop the file. Verify:
- All metros appear as grouped containers
- Services are inside their metro groups
- Cloud nodes appear with correct colors
- Connections are logical (drag a shape — connection follows)
- Text box and markers appear
- Icons render on service nodes
- Price tables are readable

- [ ] **Step 4: Import into LucidChart**

In LucidChart, File > Import > select the `.drawio` file. Verify same checklist as Step 3, plus:
- Can ungroup a metro and move services independently
- Can delete/add connections
- Can edit text labels
