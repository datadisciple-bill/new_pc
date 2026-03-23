# draw.io Export for LucidChart Editing

**Date:** 2026-03-23
**Status:** Approved

## Problem

Users want to export network diagrams from the Equinix Pricing Tool into a format they can edit in LucidChart (lucid.app). They need full structural editing: moving shapes, adding/removing nodes, reconnecting edges, and modifying the diagram significantly.

## Decision

Export diagrams as `.drawio` (draw.io / diagrams.net XML) files. LucidChart imports `.drawio` natively with good editability — shapes are individually selectable/movable, connections are logical connectors that follow shapes, and grouping is preserved.

### Why draw.io XML over alternatives

- **vs .vsdx (Visio):** Higher fidelity in LucidChart, but JS tooling for generating .vsdx is immature/unmaintained. draw.io XML is simple to generate.
- **vs SVG:** LucidChart imports SVG as flat images, not editable shapes. Doesn't meet the structural editing requirement.
- **vs CSV:** Only for structured/hierarchical diagrams (org charts). No control over visual styling or positioning.
- **Bonus:** Users without LucidChart can open `.drawio` files in diagrams.net (free).

## Architecture

### New file: `src/utils/drawioExporter.ts`

Single utility module. No external dependencies — XML is built with template literals.

**Exported functions:**

- `generateDrawioXml(projectConfig: ProjectConfig, nodes: Node[], edges: Edge[]): string` — Takes Zustand project config + current React Flow node/edge state (types from `@xyflow/react`), returns draw.io XML string.
- `downloadDrawio(xmlContent: string, projectName: string): void` — Triggers browser download of `{projectName}.drawio`. Uses `application/xml` MIME type, follows the same `URL.createObjectURL` + `link.click()` + `URL.revokeObjectURL` pattern as the existing `downloadCsv` in `csvGenerator.ts`.

**Internal helpers (not exported):**

- `buildMxGraphSkeleton()` — Creates XML document: `<mxfile>` > `<diagram>` > `<mxGraphModel>` > `<root>`
- `addMetroGroup(metro, position, dimensions)` — Emits grouped metro container + region-colored header + child service cells
- `addServiceCell(service, parentId, position)` — Emits service shape inside metro group with base64 SVG icon
- `addCloudCell(cloudNode, position)` — Emits cloud provider shape with brand color
- `addFloatyNode(node)` — Dispatch function that switches on node type and delegates to type-specific logic:
  - TextBox → text-only cell (no fill, no border)
  - LocalSite → rectangle with base64 SVG icon + labels
  - AnnotationMarker → ellipse with red fill + number
  - AnnotationLegend → rectangle with marker description text rows
  - MultipointNetwork → rounded rectangle with network-type color
- `addPriceTable(priceData, position)` — Emits HTML-label table cell
- `addEdge(connection, sourceId, targetId)` — Emits connector with style, labels, handle positions
- `mapHandleToExitEntry(handleSide)` — Converts `'left'|'right'|'top'|'bottom'` to draw.io exit/entry coordinates

### Data flow

```
Zustand store (projectConfig)
  + React Flow state (nodes with positions, edges)
    -> generateDrawioXml()
      -> .drawio XML string
        -> downloadDrawio()
          -> browser file download
```

### UI integration

New "Export to LucidChart" button placed **inside `NetworkDiagram.tsx`** (within the `<ReactFlowProvider>` context), not in the external export area. This is required because `useReactFlow()` throws if called outside the provider. The button uses `useReactFlow().getNodes()` and `useReactFlow().getEdges()` to access current diagram state, then calls `generateDrawioXml` with the Zustand project config + the React Flow nodes/edges.

## Node Type Mapping

| React Flow Node | draw.io Shape | Grouping | Style |
|---|---|---|---|
| MetroNode | `mxCell` with `group` style + child header label | Parent group — children nest inside | Light gray fill `#F4F4F4`, region-colored header bar (AMER `#3B82F6`, EMEA `#10B981`, APAC `#8B5CF6`) |
| ServiceNode | Rounded rectangle with base64 SVG icon | Child of metro group | Black fill `#000000`, white text, embedded icon |
| CloudNode | Rounded rectangle | Standalone | Brand color fill (AWS `#FF9900`, Azure `#0067B8`, GCP `#4285F4`, etc.), white text. Note: GCP uses `#4285F4` (actual brand blue) — `brandColors.ts` has `#0070F2` shared with IBM/SAP; the exporter should use distinct colors where possible. |
| LocalSiteNode | Rectangle with base64 SVG icon | Standalone | White fill, embedded icon, name + description labels |
| TextBoxNode | Text-only `mxCell` | Standalone | No fill, no border, user text content |
| AnnotationMarkerNode | Ellipse (circle) | Standalone | Red fill `#E91C24`, white number label |
| AnnotationLegendNode | Rectangle with text rows | Standalone | White fill, marker description text |
| MultipointNetworkNode | Rounded rectangle | Standalone | Network-type color fill (`#0067B8` EVPLAN/EPLAN, `#00A85F` IPWAN, `#7B2D8E` EVPTREE/EPTREE) |
| PriceTableNode | HTML table `mxCell` | Standalone | Table of bandwidth/price rows |
| NEPriceTableNode | HTML table `mxCell` | Standalone | Table of device size/term rows |
| EIAPriceTableNode | HTML table `mxCell` | Standalone | Table of bandwidth tiers |

## Edge Type Mapping

| Edge Type | draw.io Style |
|---|---|
| Intra-metro (solid) | `strokeColor=#00A85F;dashed=0` |
| Inter-metro (solid) | `strokeColor=#00A85F;dashed=0` |
| IP-WAN (dashed) | `strokeColor=#000000;dashed=1;dashPattern=8 4` |
| Cloud/network (dotted) | `strokeColor=#0067B8;dashed=1;dashPattern=2 2` |
| Redundant (double-line) | Two parallel `mxCell` connectors with `exitDy`/`entryDy` offsets (see below) |

All edges are logical connectors — they attach to source/target shape IDs so connections follow when shapes are dragged in LucidChart.

### Handle-side pinning

Your app's `handleSide` maps to draw.io exit/entry coordinates:

| HandleSide | exitX/entryX | exitY/entryY |
|---|---|---|
| left | 0 | 0.5 |
| right | 1 | 0.5 |
| top | 0.5 | 0 |
| bottom | 0.5 | 1 |

### Edge labels

Bandwidth/redundancy text and optional price text become draw.io edge labels, editable in place after import.

### Redundant connections

draw.io has no native double-line style. Redundant connections emit two parallel connectors using `exitDy`/`entryDy` style offsets to create visual separation:
- Connector 1: `exitDy=-4;entryDy=-4` (shifted up/left)
- Connector 2: `exitDy=4;entryDy=4` (shifted down/right)

Both connectors share the same source/target IDs and base style. Each line is independently selectable/editable — better for structural editing. The exact offset values may need tuning during implementation to match the visual weight of the app's double-line rendering.

## Icon Embedding

11 SVG icon files from `src/assets/icons/` are embedded as base64 in the draw.io cell style (`equinix-logo.svg` is excluded — per CLAUDE.md, no partner/customer logos in diagrams):

```
shape=image;image=data:image/svg+xml;base64,{encoded};aspect=fixed;imageWidth=24;imageHeight=24;
```

### Icons used

**Service nodes (7):**
- `fabric-port.svg` — Fabric Port
- `network-edge.svg` — Network Edge
- `internet-access.svg` — Internet Access
- `cloud-router.svg` — Cloud Router
- `colocation.svg` — Colocation
- `nsp.svg` — NSP
- `cross-connect.svg` — Cross Connect

**Local site nodes (9 options, shares 5 with above):**
- `building-corporate.svg` — Corporate / Enterprise
- `building-factory.svg` — Factory / Manufacturing
- `building-home.svg` — Home / Branch Office
- `people-user.svg` — User / People
- Plus: colocation, network-edge, fabric-port, internet-access, cloud-router (shared)

**Cloud nodes:** No custom SVG icons — use brand-colored rectangles with text labels (matches current diagram appearance).

### Embedding approach

Icons are imported as raw SVG strings at module load time using Vite's `?raw` query suffix — this avoids runtime fetch issues in production builds where asset paths are hashed:

```ts
import fabricPortSvg from '@/assets/icons/fabric-port.svg?raw';
import networkEdgeSvg from '@/assets/icons/network-edge.svg?raw';
// ... etc for all 11 icons
```

At export time:
1. Look up the raw SVG string for the node's icon type
2. Base64-encode with `btoa(svgString)`
3. Embed in the cell `style` attribute as a `data:image/svg+xml;base64,` URI

Total overhead: ~14KB for all 11 icons (each SVG is ~1-2KB).

## ID Strategy

Sequential numeric IDs starting at 2 (cells 0 and 1 are reserved by draw.io for root layer and default parent). IDs are assigned incrementally as the exporter walks the graph. No UUIDs — these diagrams are for explaining architectures, not for round-tripping back into the app.

## Position Strategy

React Flow and draw.io both use pixel-based x/y coordinates with the same convention (top-left origin, children relative to parent for groups). Positions map 1:1:

- Metro groups: absolute position from React Flow
- Service nodes inside metros: relative position to parent group
- Floaty nodes (text boxes, local sites, markers): absolute position from React Flow
- Scale factor: 1:1 initially (adjustable if needed)

If the user has dragged nodes, the current React Flow positions are used. If pure auto-layout, positions come from `buildDiagramLayout`.

## Scope

### In scope
- New `src/utils/drawioExporter.ts` module
- "Export to LucidChart" button in export UI area
- All 11 node types mapped to draw.io shapes
- All edge types as logical connectors with styles and labels
- Metro grouping preserved
- Equinix branding colors carried over
- SVG icons embedded as base64
- Price tables as HTML-label cells

### Out of scope
- Round-trip import (draw.io back into app) — one-way export only
- .vsdx export — can be added later if demand warrants
- Custom draw.io shape libraries / stencils
- Live legend auto-generation — AnnotationLegendNode exports as a static labeled rectangle

## Testing

- **Unit tests:** Verify `generateDrawioXml` produces valid XML for each node type, edge type, grouping, and icon embedding
- **Manual validation:** Export a sample diagram, import into LucidChart, verify:
  - Shapes are individually selectable and movable
  - Connections follow when shapes are dragged
  - Metro groups can be moved as a unit or ungrouped
  - Icons render correctly
  - Colors and labels are preserved
  - Price tables are readable
