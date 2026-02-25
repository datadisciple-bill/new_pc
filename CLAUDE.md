# Equinix Pricing Document Generator

## What This Is

A mobile-first web app for Equinix Presales Global Solutions Architects. It lets them select Equinix metro locations, configure services (Fabric Ports, Network Edge, Internet Access, Virtual Connections, Fabric Cloud Router), view a branded network diagram, see real-time pricing, and export a CSV pricing sheet.

Full spec: `TECHNICAL_SPECIFICATION.md`
Branding reference: `Equinix_solution-diagrams.pptx`

## Tech Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand (single store at `src/store/configStore.ts`)
- **Diagrams:** React Flow for the interactive network diagram canvas
- **CSV:** Client-side generation (papaparse or manual)
- **Testing:** Vitest + React Testing Library

## Commands

```
npm run dev        # Start dev server
npm run build      # Production build
npm run test       # Run tests (Vitest)
npm run lint       # Lint check
npm run preview    # Preview production build locally
```

## Architecture

```
src/
  api/           # All Equinix API calls + OAuth token management
    client.ts    # Base HTTP client (auth headers, retry, backoff)
    auth.ts      # OAuth 2.0 client_credentials flow
    fabric.ts    # Fabric v4 API (metros, ports, connections, pricing, FCR)
    networkEdge.ts  # Network Edge v1 API (devices, types, pricing)
    internetAccess.ts  # EIA v2 API (locations, services)
  components/
    auth/        # Login form
    metro/       # Metro selection UI
    services/    # Config forms: FabricPortConfig, NetworkEdgeConfig, etc.
    diagram/     # React Flow canvas, metro nodes, service nodes, edges
    pricing/     # Price sheet table, line items, summary
    export/      # CSV export button
  hooks/         # useAuth, useMetros, usePricing, useServices
  store/         # Zustand store (configStore.ts) — single source of truth
  types/         # TypeScript interfaces (equinix.ts, config.ts, pricing.ts)
  utils/         # csvGenerator, diagramLayout, priceCalculator
  constants/     # brandColors.ts, serviceDefaults.ts
```

## Key Conventions

- **All API calls go through `src/api/client.ts`** — never call fetch/axios directly from components
- **State lives in Zustand** (`src/store/configStore.ts`) — components read from the store, actions modify it
- **Tailwind only** — no CSS modules, no styled-components
- **Mobile-first** — design for mobile viewport first, scale up
- **Types over `any`** — all API responses and state must be typed (see `src/types/`)
- **No credentials on disk** — API tokens in memory only, cleared on tab close

## Equinix API Details

### Authentication
- `POST https://api.equinix.com/oauth2/v1/token` with `client_credentials` grant
- Token valid 60 minutes, refresh at 50 minutes
- All calls: `Authorization: Bearer <token>`

### Key Endpoints
| API | Base URL | Pricing Endpoint |
|-----|----------|-----------------|
| Fabric v4 | `https://api.equinix.com/fabric/v4` | `POST /fabric/v4/prices/search` |
| Network Edge v1 | `https://api.equinix.com/ne/v1` | `GET /ne/v1/prices` |
| Internet Access v2 | `https://api.equinix.com/internetAccess/v2` | **None** (show "Quote Required") |

### Pricing Filter Types (for `/fabric/v4/prices/search`)
- `VIRTUAL_PORT_PRODUCT` — Fabric Ports
- `VIRTUAL_CONNECTION_PRODUCT` — Virtual Connections
- `CLOUD_ROUTER_PRODUCT` — Fabric Cloud Router
- `FABRIC_GATEWAY_PRODUCT` — Fabric Gateways
- `IP_BLOCK_PRODUCT` — IP Blocks

### Rate Limits
No published limits. Target max 5 req/sec. Handle 429 with exponential backoff (2s, 4s, 8s, 16s). Cache metros, device types, and service profiles aggressively.

## Branding Rules (Network Diagram)

The diagram MUST follow Equinix branding from `Equinix_solution-diagrams.pptx`:

- **Equinix product bars:** Black background (`#000000`), white icon + text
- **Cloud provider bars:** Brand color background, white text
- **Metro containers:** Light gray fill (`#F4F4F4`), metro name header
- **Annotations:** Green text (`#33A85C`), green arrows (`#00A85F`)
- **Numbered markers:** Red circles (`#E91C24`)
- **Lines:** Solid = physical, dashed = virtual, double = redundant
- **Always include a legend**
- **No partner/customer logos** — use generic icons only
- **Font:** Arial, 10pt bold for product names

Cloud provider colors: AWS `#FF9900`, Azure `#0067B8`, GCP `#0070F2`, Oracle `#ED1C23`, IBM `#0070F2`, Alibaba `#FE8720`, SAP `#0070F2`, Salesforce `#139CD9`

## Security Rules

- Credentials NEVER in localStorage, cookies, or server storage — `sessionStorage` or memory only
- HTTPS only, TLS 1.2+
- No logging of request/response bodies containing tokens
- No third-party analytics that could intercept tokens
- CSP headers to prevent XSS

## Development Phases

1. Project scaffolding + data model + Zustand store
2. API client layer (auth, Fabric, Network Edge, EIA) + mock data
3. Auth UI + metro selection screen
4. Service configuration forms (one at a time: Ports → NE → EIA → VCs → FCR)
5. Network diagram (React Flow + Equinix branding)
6. Price sheet + CSV export
7. Mobile responsiveness + polish
8. Tests (unit + integration + E2E)

## Notes

- EIA has no pricing API — always show "Quote Required" with manual price override
- Equinix Metal is excluded (sunset June 2026)
- API docs live at `docs.equinix.com` (not the old `developer.equinix.com`)
- The PPTX branding guide is the source of truth for diagram styling
