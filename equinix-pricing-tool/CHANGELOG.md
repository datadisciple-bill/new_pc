# Changelog

All notable changes to the Equinix Pricing Tool will be documented in this file.

## [0.2.0] - 2026-03-23

### Added

- **LucidChart / draw.io export** — Export your network diagrams as `.drawio` files that can be imported into LucidChart or opened in diagrams.net (free) for full editing. Shapes are individually movable, connections follow when you drag, and metro grouping is preserved. Click the "LucidChart" button in the diagram toolbar to download. *(Feature requested by Brock King)*
  - All 11 node types exported as editable shapes (metros, services, clouds, text boxes, local sites, annotation markers, legend, multipoint networks, price tables)
  - Logical connectors that maintain source/target relationships when shapes are moved
  - Equinix branding colors and SVG icons embedded in the export
  - Metro containers exported as groups — move the whole metro or ungroup to restructure
  - Price tables exported as readable HTML tables
  - Solid, dashed, dotted, and redundant connection line styles preserved

## [0.1.0] - 2026-03-20

### Added

- Initial release with metro selection, service configuration, network diagramming, real-time pricing, and CSV export
- Fabric Ports, Network Edge, Internet Access, Virtual Connections, and Fabric Cloud Router support
- Interactive React Flow diagram with Equinix branding
- Pricing trust badges, error handling, and manual price entry
- Keyboard accessibility (Escape to close modals)
- Client Secret input field masking
