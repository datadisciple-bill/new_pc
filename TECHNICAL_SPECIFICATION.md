# Equinix Pricing Document Generator — Technical Specification

## Document Purpose

This specification is intended to be given to Claude Code (or any AI coding assistant) to build the application described below. It contains the full requirements, API details, branding rules, architecture, and workflow needed for implementation.

---

## 1. Project Overview

### 1.1 Problem Statement

Equinix Presales Global Solutions Architects frequently create pricing documents alongside network diagrams to show customers a menu of connectivity choices and costs. This is a manual, repetitive process. We need a tool that automates the selection of Equinix services, generates branded network diagrams, calculates pricing, and exports the results.

### 1.2 What This Application Does

A mobile-friendly web application that allows a Global Solutions Architect (GSA) to:

1. Select Equinix metro locations
2. Choose services within those locations (Network Edge, Equinix Fabric, Internet Access, etc.)
3. Configure the parameters of each selected service (port speeds, device types, redundancy, etc.)
4. View a live network diagram that updates as services are added (following Equinix branding guidelines)
5. View a price sheet with line-item costs for everything selected
6. Modify selections and see pricing update in real time
7. Export a CSV file with full line-item details and pricing

### 1.3 Target Users

- Equinix Presales Global Solutions Architects
- Used on mobile devices (phones, tablets) as well as desktops
- Users will have Equinix API credentials (Client ID + Client Secret)

---

## 2. User Workflow (Step-by-Step)

### Step 1: Authentication
- User enters their Equinix API Client ID and Client Secret
- App authenticates via OAuth 2.0 client credentials flow
- Credentials are stored only in the browser session (never persisted to disk/server)

### Step 2: Select Metro Locations
- App fetches available metros from the Equinix Fabric API
- User selects one or more metro locations (e.g., "Washington, D.C.", "London", "Singapore")
- Metros are displayed with their metro codes (e.g., `DC`, `LD`, `SG`)
- User can add/remove metros at any time

### Step 3: Select Services Per Metro
For each selected metro, the user picks which Equinix services they want:
- **Equinix Fabric Ports** — physical port connections
- **Network Edge** — virtual network devices (routers, firewalls, SD-WAN)
- **Equinix Internet Access (EIA)** — blended internet connectivity
- **Virtual Connections** — Layer 2/Layer 3 connections between endpoints (port-to-port, port-to-cloud, etc.)
- **Fabric Cloud Router (FCR)** — virtual Layer 3 routing service

### Step 4: Configure Each Service
Each service type has its own configuration options:

#### Equinix Fabric Ports
- Port speed: 1G, 10G, 25G, 50G, 100G
- Port type: Single / Redundant (LAG)
- Encapsulation: Dot1q / QinQ
- Physical port count

#### Network Edge Devices
- Device type (fetched from API: Cisco, Palo Alto, Fortinet, Juniper, etc.)
- Device package/tier (Small, Medium, Large, X-Large — affects CPU/RAM)
- Software version/image
- License model: BYOL or Subscription
- Redundant device pair: Yes/No
- Term length: 1 month, 12 months, 24 months, 36 months

#### Equinix Internet Access
- Bandwidth: 50 Mbps to 10 Gbps (varies by location)
- Routing protocol: Static, Direct, or BGP
- Connection type: Single or Dual (redundant)
- Delivery method: Via Fabric Port or via Network Edge device

#### Virtual Connections (Virtual Circuits)
- Connection type: EVPL_VC (Layer 2) or IP_VC (Layer 3 via FCR)
- A-Side endpoint: Port, Network Edge device, or FCR
- Z-Side endpoint: Port, cloud provider service profile (AWS Direct Connect, Azure ExpressRoute, Google Cloud Interconnect, Oracle FastConnect, etc.), or another Network Edge device
- Bandwidth: 50 Mbps to 50 Gbps
- Redundancy: Single or redundant connections

#### Fabric Cloud Router (FCR)
- Package: Standard, Premium
- Location (metro)
- Connections to configure (handled via Virtual Connections above)

### Step 5: View Network Diagram
- A branded network diagram is generated/updated in real time as services are added
- Diagram follows Equinix branding guidelines (see Section 5)
- Metro locations shown as container boxes
- Services shown inside their respective metro containers with proper icons
- Connections shown as lines between endpoints

### Step 6: View & Adjust Pricing
- Price sheet updates as services are configured
- Line items grouped by metro, then by service type
- Each line item shows: service name, configuration details, monthly recurring charge (MRC), and any non-recurring charge (NRC)
- Subtotals per metro, grand total at the bottom
- User can change any parameter and pricing updates immediately

### Step 7: Export
- Export a CSV file with columns: Metro, Service Type, Service Name, Configuration Details, Quantity, MRC (Monthly), NRC (One-Time), Term Length, Annual Cost
- CSV includes a summary section at the bottom with totals

---

## 3. Equinix API Integration

### 3.1 Authentication

**Endpoint:** `POST https://api.equinix.com/oauth2/v1/token`

**Request Body:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>"
}
```

**Response:** Returns `access_token` (Bearer token), valid for 60 minutes.

**Token Refresh:** `POST https://api.equinix.com/oauth2/v1/refreshaccesstoken`

**Implementation Notes:**
- Store the token in memory only
- Implement automatic token refresh before expiry (e.g., refresh at 50 minutes)
- All subsequent API calls include header: `Authorization: Bearer <access_token>`

### 3.2 Equinix Fabric API v4

**Base URL:** `https://api.equinix.com/fabric/v4`

#### Key Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/fabric/v4/metros` | GET | List all available metros with latency data |
| `/fabric/v4/ports` | GET | List user's Fabric ports |
| `/fabric/v4/ports` | POST | Create a new port (for quoting, use pricing endpoint instead) |
| `/fabric/v4/connections` | POST | Create a connection |
| `/fabric/v4/connections/validate` | POST | Validate a connection configuration |
| `/fabric/v4/connections/{id}` | GET | Get connection details |
| `/fabric/v4/serviceProfiles` | GET | List available service profiles (cloud providers, etc.) |
| `/fabric/v4/serviceProfiles/search` | POST | Search service profiles by criteria |
| `/fabric/v4/routers` | POST | Create a Fabric Cloud Router |
| `/fabric/v4/routers/{id}` | GET | Get FCR details |
| `/fabric/v4/routers/search` | POST | Search for FCRs |
| `/fabric/v4/prices/search` | POST | **Retrieve pricing for Fabric products** |

#### Pricing Endpoint (Critical):
`POST /fabric/v4/prices/search` — This is the primary pricing endpoint. Use it to get prices for:
- Fabric Ports (by speed, type, metro)
- Virtual Connections (by bandwidth, type)
- Fabric Cloud Router (by package)
- Network Edge Device Link Groups

### 3.3 Network Edge API

**Base URL:** `https://api.equinix.com/ne/v1`

#### Key Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ne/v1/devices` | GET | List existing virtual devices |
| `/ne/v1/devices` | POST | Create a virtual device |
| `/ne/v1/devices/{uuid}` | GET | Get device details |
| `/ne/v1/devices/types` | GET | **List available device types (vendors, models)** |
| `/ne/v1/devices/types/{deviceTypeCode}/interfaces` | GET | Get interface details for a device type |
| `/ne/v1/metros` | GET | **List metros where Network Edge is available** |

#### Network Edge Pricing:
- Pricing is based on device specifications (CPU count) regardless of vendor
- Tiers: Small, Medium, Large, X-Large
- Use `/fabric/v4/prices/search` with device type info to get pricing
- Monthly Recurring Charge (MRC) and possible Non-Recurring Charge (NRC)
- Term options: Monthly, 1-year, 2-year, 3-year (longer terms = lower MRC)

### 3.4 Equinix Internet Access API

**Base URL:** `https://api.equinix.com/internetAccess/v2`

#### Key Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/internetAccess/v2/ibxs` | GET | **List locations where EIA is available** |
| `/internetAccess/v2/services` | POST | Order an EIA service instance |
| `/internetAccess/v2/services/{id}` | GET | Get service instance details |
| `/internetAccess/v1/services/{id}` | GET | Get v1 service instance details |

#### EIA Configuration:
- Connection type: `IA_VC`
- Service profile ID for Internet Access: `32d81829-0bf8-45d5-84e2-7289a553dbb6`
- Routing options: `STATIC`, `DIRECT`, `BGP`
- Redundancy: `SINGLE` or `DUAL`
- Bandwidth options range from 50 Mbps to 10 Gbps per location

### 3.5 API Rate Limits

Equinix does not publish specific rate limit numbers. Implementation should:
- Check response headers for `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
- Implement exponential backoff on `429 Too Many Requests` responses
- Cache API responses where appropriate (e.g., metros, device types, service profiles — these change infrequently)
- Target no more than 5 requests/second as a conservative baseline

### 3.6 Handling Unavailable Pricing Data

Some pricing may not be available through the API (certain NRC charges, custom-quoted items). The application should:
- Display "Contact Equinix for pricing" for items where API returns no price
- Allow the user to manually enter a price override for any line item
- Clearly mark estimated vs. confirmed prices in the export

---

## 4. Technical Architecture

### 4.1 Recommended Stack

**Frontend (Primary Application):**
- **Framework:** React with TypeScript (or Next.js for SSR if SEO matters, but this is an internal tool so plain React/Vite is fine)
- **UI Library:** Tailwind CSS + shadcn/ui (or similar) for mobile-responsive components
- **Diagram Rendering:** React Flow (reactflow.dev) or D3.js for the network diagram canvas
- **State Management:** Zustand or React Context (avoid Redux for this scale)
- **CSV Export:** Client-side using a library like `papaparse` or manual CSV string generation

**Backend:**
- **Option A (Recommended): Serverless / BFF proxy** — A lightweight backend (Node.js/Express or Next.js API routes) that proxies Equinix API calls. This keeps API credentials out of browser network traffic and allows server-side caching.
- **Option B: Client-only** — All API calls made directly from the browser. Simpler but exposes API traffic patterns in browser dev tools.

**Deployment:**
- Vercel, Netlify, or any static hosting for the frontend
- If using a backend proxy: deploy as a containerized service or serverless functions

### 4.2 Project File Structure (Recommended)

```
equinix-pricing-tool/
├── public/
│   └── icons/                    # Equinix product SVG icons
├── src/
│   ├── api/
│   │   ├── auth.ts               # OAuth token management
│   │   ├── fabric.ts             # Fabric API calls (metros, ports, connections, pricing)
│   │   ├── networkEdge.ts        # Network Edge API calls (devices, types, metros)
│   │   ├── internetAccess.ts     # EIA API calls
│   │   └── client.ts             # Base HTTP client with auth headers, retry logic
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.tsx
│   │   ├── metro/
│   │   │   ├── MetroSelector.tsx
│   │   │   └── MetroCard.tsx
│   │   ├── services/
│   │   │   ├── ServiceSelector.tsx
│   │   │   ├── FabricPortConfig.tsx
│   │   │   ├── NetworkEdgeConfig.tsx
│   │   │   ├── InternetAccessConfig.tsx
│   │   │   ├── VirtualConnectionConfig.tsx
│   │   │   └── CloudRouterConfig.tsx
│   │   ├── diagram/
│   │   │   ├── NetworkDiagram.tsx      # Main diagram canvas
│   │   │   ├── MetroNode.tsx           # Metro container node
│   │   │   ├── ServiceNode.tsx         # Individual service node
│   │   │   ├── ConnectionEdge.tsx      # Connection line
│   │   │   └── DiagramLegend.tsx       # Line/icon legend
│   │   ├── pricing/
│   │   │   ├── PriceSheet.tsx
│   │   │   ├── PriceLineItem.tsx
│   │   │   └── PriceSummary.tsx
│   │   └── export/
│   │       └── CsvExport.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useMetros.ts
│   │   ├── usePricing.ts
│   │   └── useServices.ts
│   ├── store/
│   │   └── configStore.ts        # Zustand store for all user selections
│   ├── types/
│   │   ├── equinix.ts            # API response types
│   │   ├── config.ts             # User configuration types
│   │   └── pricing.ts            # Pricing data types
│   ├── utils/
│   │   ├── csvGenerator.ts
│   │   ├── diagramLayout.ts      # Auto-layout algorithm for diagram
│   │   └── priceCalculator.ts
│   ├── constants/
│   │   ├── brandColors.ts        # Equinix brand color palette
│   │   └── serviceDefaults.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

### 4.3 Data Model

```typescript
// Core configuration that the user builds up
interface ProjectConfig {
  id: string;
  name: string;
  metros: MetroSelection[];
  connections: VirtualConnection[];
}

interface MetroSelection {
  metroCode: string;          // e.g., "DC", "LD", "SG"
  metroName: string;          // e.g., "Washington, D.C."
  services: ServiceSelection[];
}

interface ServiceSelection {
  id: string;
  type: 'FABRIC_PORT' | 'NETWORK_EDGE' | 'INTERNET_ACCESS' | 'CLOUD_ROUTER';
  config: FabricPortConfig | NetworkEdgeConfig | InternetAccessConfig | CloudRouterConfig;
  pricing: PricingResult | null;
}

interface FabricPortConfig {
  speed: '1G' | '10G' | '25G' | '50G' | '100G';
  type: 'SINGLE' | 'REDUNDANT';
  encapsulation: 'DOT1Q' | 'QINQ';
  quantity: number;
}

interface NetworkEdgeConfig {
  deviceTypeCode: string;     // from API
  deviceTypeName: string;
  vendorName: string;
  packageCode: string;        // size tier
  softwareVersion: string;
  licenseType: 'BYOL' | 'SUBSCRIPTION';
  redundant: boolean;
  termLength: 1 | 12 | 24 | 36;  // months
}

interface InternetAccessConfig {
  bandwidthMbps: number;
  routingProtocol: 'STATIC' | 'DIRECT' | 'BGP';
  connectionType: 'SINGLE' | 'DUAL';
  deliveryMethod: 'FABRIC_PORT' | 'NETWORK_EDGE';
}

interface CloudRouterConfig {
  package: 'STANDARD' | 'PREMIUM';
}

interface VirtualConnection {
  id: string;
  type: 'EVPL_VC' | 'IP_VC';
  aSide: ConnectionEndpoint;
  zSide: ConnectionEndpoint;
  bandwidthMbps: number;
  redundant: boolean;
  pricing: PricingResult | null;
}

interface ConnectionEndpoint {
  metroCode: string;
  type: 'PORT' | 'NETWORK_EDGE' | 'CLOUD_ROUTER' | 'SERVICE_PROFILE';
  serviceId: string;          // reference to a ServiceSelection.id or service profile UUID
  serviceProfileName?: string; // e.g., "AWS Direct Connect", "Azure ExpressRoute"
}

interface PricingResult {
  mrc: number;                // Monthly Recurring Charge
  nrc: number;                // Non-Recurring Charge
  currency: string;           // e.g., "USD"
  isEstimate: boolean;        // true if price is estimated/not from API
  breakdown: PricingBreakdownItem[];
}

interface PricingBreakdownItem {
  description: string;
  mrc: number;
  nrc: number;
}
```

---

## 5. Equinix Branding Guidelines for Network Diagrams

The following rules are extracted from the official Equinix Solution Diagrams guide (June 2025). The generated network diagrams MUST follow these rules.

### 5.1 General Layout Rules

1. **Metro/Location containers**: Represented as nested rectangular cards (rounded corners optional for grouping)
   - Outer container: light gray background (`#F4F4F4`) with metro name in the header
   - Header bar: white text, with the metro/location name
   - Nested cards for sub-groupings (e.g., customer deployments within a metro)

2. **Hierarchy levels**:
   - Level 1: Overall diagram background (white)
   - Level 2: Metro/geography container (light border, gray header)
   - Level 3: Service grouping within metro
   - Level 4: Specific deployment details

3. **Increasing detail is progressive**: Cards can be widened to fit content. Show more detail for specific customer solutions, less for generic use cases.

### 5.2 Color Palette

#### Equinix Core Colors
| Usage | Color | Hex |
|-------|-------|-----|
| Equinix products/services text and bars | Black | `#000000` |
| Equinix product icon bar background | Black | `#000000` |
| Annotation/callout text | Green | `#33A85C` |
| Annotation/callout arrows | Green | `#00A85F` |
| Numbered markers (circles) | Red | `#E91C24` |
| Non-specific elements | Light Gray | `#F4F4F4` |
| Customer-specific text | Dark Navy | `#1B2A34` |

#### Cloud Provider Brand Colors (for Z-Side cloud blocks)
| Provider | Hex |
|----------|-----|
| AWS | `#F8981F` (or `#FF9900`) |
| Microsoft Azure | `#0067B8` (or `#0869E2`) |
| Google Cloud | `#0070F2` |
| Oracle Cloud | `#ED1C23` |
| IBM Cloud | `#0070F2` |
| Alibaba Cloud | `#FE8720` |
| SAP | `#0070F2` |
| Salesforce | `#139CD9` |
| Office 365 | `#D83B01` |

#### Partner/NSP Colors
| Provider | Hex |
|----------|-----|
| Colt | `#04D1B7` |
| BT | `#600AA4` |
| Lumen | `#05A8E1` |
| AT&T | `#05A8E1` |
| Telstra | `#154A94` |
| Verizon | `#ED1C23` |
| Zayo Group | `#F9901E` |
| Cisco Webex | `#078855` |
| NVIDIA | `#7DB327` |

### 5.3 Icon Rules

1. **Equinix product icons**: Always use official Equinix product icons. They appear as a black bar with a white icon and product name. Icon bar height = 0.33 inches (standardized).

2. **Equinix Products requiring icons** (from the branding guide):
   - Equinix Fabric (with ® when full name used)
   - Metal
   - Network Edge
   - Cross Connect (same icon as Fiber Connect and Metro Connect)
   - Private Cage
   - Precision Time
   - Internet Exchange
   - Fabric Cloud Router (unique icon — does NOT use the Fabric icon)
   - Secure Cabinet / Secure Cabinet Express (same icon)
   - Internet Access

3. **Non-specific deployment elements** (gray bars with icons):
   - WAN, Data Center, HQ, Remote Sites, ISP, NSP, SD-WAN, Cloud Providers, Customer A, Meet-Me Room, Firewall, AI, Switch, Router, Virtual Device, Hardware, Compute, Users, Load Balancing, Storage

4. **No partner/customer logos**: Use generic icons to communicate functionality. Partner brand colors highlight the ecosystem.

5. **Cloud service providers**: Can be featured at the top level with their brand color as the bar background. Their product names (e.g., "Direct Connect", "ExpressRoute") listed as bullets.

### 5.4 Line/Connection Rules

1. **Lines are only for connections** — never decorative
2. **Solid lines**: Default for all connections
3. **Dashed lines**: Used to differentiate connection types when needed
4. **Double lines**: Show redundancy
5. **Label every line** if there is more than one connection type in the diagram
6. **Line colors**: Default is black. Use color only when necessary to differentiate (and document in legend)
7. **Always include a legend** below the diagram explaining line types
8. **Suggested line conventions**:
   - Solid line = Physical Interconnection
   - Dashed line = Virtual Interconnection
   - Double solid = Physical Interconnection, Redundant
   - Double dashed = Virtual Interconnection, Redundant
   - Dotted line = Longer-Distance Physical Interconnection

### 5.5 Text Rules

1. **Font**: Arial
2. **Product names on bars**: 10pt, Bold, Initial Caps
3. **Sub-details**: 10pt, Initial Caps (not bold)
4. **Long descriptions**: Use numbered markers (red circles) with sentence-case explanations below the diagram
5. **Short product name** (e.g., "Fabric" instead of "Equinix Fabric") is acceptable if the full name appears elsewhere
6. **Trademark symbols**: Use ® for Equinix Fabric when the full name is used. Include attribution statements in the footer.

### 5.6 Diagram Implementation in the App

For the web application, translate these PPTX rules to SVG/Canvas:

- Use SVG elements for clean scaling on all devices
- Recreate the icon bars as SVG components: black rounded rectangle with white icon + text
- Cloud provider bars: colored rectangle matching their brand color with white text
- Metro containers: rounded rectangle with gray fill and metro name header
- Connections: SVG `<line>` or `<path>` elements with appropriate stroke styles
- Auto-layout: Use a hierarchical left-to-right or top-to-bottom layout algorithm
- The diagram should be pannable and zoomable on mobile

---

## 6. Pricing Sheet Requirements

### 6.1 Display Format

The price sheet should be a scrollable table/list view with:

| Column | Description |
|--------|-------------|
| Metro | Metro location code + name |
| Service | Service type (Fabric Port, Network Edge, etc.) |
| Description | Specific configuration (e.g., "10G Redundant Port, Dot1q") |
| Term | Contract term (Monthly, 1yr, 2yr, 3yr) |
| Qty | Quantity |
| MRC | Monthly Recurring Charge |
| NRC | Non-Recurring Charge (one-time) |
| Annual Cost | MRC × 12 × Qty |

### 6.2 Grouping and Totals

- Group by metro
- Subtotal per metro (MRC and NRC)
- Grand total at the bottom
- Optionally show total contract value (MRC × term months × Qty + NRC)

### 6.3 CSV Export Format

The CSV export should contain all the columns above plus:
- A header row with column names
- One row per line item
- A blank row before the summary section
- Summary rows: Total MRC, Total NRC, Total Annual Cost, Total Contract Value
- Filename format: `Equinix_Pricing_<CustomerName>_<Date>.csv`

---

## 7. Mobile-First Design Requirements

### 7.1 Responsive Layout

- **Mobile (< 768px)**: Single column layout. Diagram and pricing are separate tabs/screens.
- **Tablet (768px - 1024px)**: Two-column layout. Diagram on top, pricing below.
- **Desktop (> 1024px)**: Three-panel layout. Left: service configuration. Center: diagram. Right: pricing.

### 7.2 Touch Interactions

- Diagram: pinch-to-zoom, two-finger pan
- Service configuration: native mobile form controls (dropdowns, sliders for bandwidth)
- Swipe between steps on mobile (metro selection → service config → diagram → pricing)

### 7.3 Mobile-Specific UI

- Bottom navigation bar with tabs: Metros | Services | Diagram | Pricing
- Floating action button (FAB) for "Add Service" and "Export CSV"
- Pull-to-refresh to re-fetch pricing data
- Collapsible metro cards to manage vertical space

---

## 8. Error Handling & Edge Cases

### 8.1 API Errors

- **401 Unauthorized**: Redirect to login, clear token
- **403 Forbidden**: Show message that the user lacks permissions for the requested resource
- **429 Rate Limited**: Queue the request and retry with exponential backoff (2s, 4s, 8s, 16s)
- **500+ Server Error**: Show generic error, offer retry button
- **Network offline**: Cache last-known data, show offline indicator, queue changes

### 8.2 Data Edge Cases

- Service not available in a metro → gray out / disable with tooltip explaining unavailability
- Pricing not returned by API → show "Quote Required" with manual override input
- User selects a connection between two metros where no Fabric path exists → validate and warn before adding
- Maximum of ~20 metros and ~50 services per project (reasonable limit for diagram readability)

---

## 9. Security Considerations

- API credentials are **never stored** in localStorage, cookies, or server-side storage
- Use `sessionStorage` or in-memory state only — credentials are lost on tab close
- If a backend proxy is used, it should not log request/response bodies containing credentials
- HTTPS only — all API calls go over TLS 1.2+
- No third-party analytics or tracking scripts that could intercept API tokens
- Content Security Policy headers to prevent XSS

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Price calculation logic
- CSV generation
- Data model transformations
- API response parsing

### 10.2 Integration Tests

- API client with mocked responses
- Authentication flow
- Service configuration → pricing flow

### 10.3 E2E Tests

- Full workflow: login → select metro → add services → view diagram → export CSV
- Mobile viewport testing
- Offline mode behavior

### 10.4 Mock Data

Create a set of mock API responses for development and testing without live API access:
- Mock metros list (10+ real Equinix metros)
- Mock device types (5-10 common Network Edge devices)
- Mock service profiles (AWS, Azure, GCP, Oracle)
- Mock pricing responses with realistic numbers

---

## 11. Recommendations for Using Claude Code to Build This

### 11.1 Break the Work into Phases

Do NOT give Claude Code this entire document at once and ask it to build everything. Instead, work through it in phases:

**Phase 1: Project Scaffolding & Core Data Model**
- Tell Claude Code: "Set up a new React + TypeScript + Vite project with Tailwind CSS. Create the TypeScript type definitions from Section 4.3 of the spec. Set up the Zustand store with the core ProjectConfig state."
- This gets the foundation right before any UI work.

**Phase 2: API Client Layer**
- Tell Claude Code: "Implement the Equinix API client layer from Section 3. Create `src/api/client.ts` with OAuth token management, automatic refresh, retry logic with exponential backoff. Then create the individual API modules for Fabric, Network Edge, and Internet Access. Include mock data for development."
- Review the API client code before moving on. Make sure token handling is correct.

**Phase 3: Authentication & Metro Selection UI**
- Tell Claude Code: "Build the login form and metro selection screen. The login form takes Client ID and Client Secret, authenticates, and stores the token in memory. The metro selector fetches metros from the Fabric API and lets the user select multiple metros. Use Tailwind for styling, mobile-first."

**Phase 4: Service Configuration Forms**
- Build one service type at a time. Start with Fabric Ports (simplest), then Network Edge (most complex), then Internet Access, then Virtual Connections.
- Tell Claude Code: "Build the Fabric Port configuration component. It should let the user select port speed, type, encapsulation, and quantity. Fetch pricing from the API when the configuration changes. Display the price below the form."

**Phase 5: Network Diagram**
- Tell Claude Code: "Build the network diagram component using React Flow (or your preferred library). It should read from the Zustand store and render a metro container for each selected metro, with service nodes inside. Connections between services should be rendered as edges. Follow the Equinix branding rules from Section 5 of the spec."
- The diagram is the most complex visual component — expect to iterate on it.

**Phase 6: Price Sheet & CSV Export**
- Tell Claude Code: "Build the pricing table component from Section 6. It reads all services and connections from the store, groups by metro, and displays line-item pricing. Add a CSV export button that generates a file per Section 6.3."

**Phase 7: Mobile Responsiveness & Polish**
- Tell Claude Code: "Make the application fully responsive per Section 7. Add the bottom navigation bar for mobile, ensure the diagram is pannable/zoomable on touch devices, and add the step-by-step wizard flow for small screens."

**Phase 8: Testing**
- Tell Claude Code: "Write unit tests for the price calculation logic, CSV generation, and API client. Write integration tests for the main workflows. Use Vitest and React Testing Library."

### 11.2 General Claude Code Tips

1. **Be specific about file paths**: Instead of "create a component for X", say "create `src/components/services/FabricPortConfig.tsx` that does X". Claude Code works better with explicit file paths.

2. **Reference existing files**: When asking Claude Code to modify something, reference what already exists. "Update `src/store/configStore.ts` to add a new action for removing a metro. The store already has `addMetro` — follow the same pattern."

3. **Show examples of desired output**: If you want a specific API response format handled, paste an example response and say "handle responses like this."

4. **One concern at a time**: Don't ask Claude Code to build a component AND style it AND connect it to the API AND write tests in one prompt. Build the component first, then style it, then wire it up.

5. **Use the CLAUDE.md file**: Create a `CLAUDE.md` file in the project root that contains project conventions, common commands, and notes. Claude Code reads this automatically at the start of each session. Put things like:
   ```
   # Project: Equinix Pricing Tool
   ## Tech Stack: React + TypeScript + Vite + Tailwind + Zustand
   ## Run dev server: npm run dev
   ## Run tests: npm run test
   ## Lint: npm run lint
   ## Key conventions:
   - All API calls go through src/api/client.ts
   - State managed in src/store/configStore.ts (Zustand)
   - Components use Tailwind classes, no CSS modules
   - Mobile-first responsive design
   ```

6. **Commit frequently**: After each phase or significant milestone, ask Claude Code to commit the work. This gives you rollback points and makes it easier to review changes.

7. **Review generated code**: Claude Code can write good code, but always review:
   - API credential handling (make sure tokens aren't leaked)
   - Error handling (make sure API failures are handled gracefully)
   - Mobile responsiveness (test on actual mobile viewport sizes)
   - Type safety (make sure TypeScript types are used correctly, not `any`)

8. **Use Claude Code's search capabilities**: If you're not sure where something is implemented, ask Claude Code "where is the pricing logic?" or "show me all files that call the Fabric API" — it can search the codebase for you.

9. **Iterate on the diagram**: The network diagram will likely need the most iteration. Start with a basic version that shows boxes and lines, then progressively add Equinix branding, icons, proper colors, and auto-layout. Don't try to get it perfect in one pass.

10. **Keep the PPTX accessible**: Keep the `Equinix_solution-diagrams.pptx` file in the project root. You can reference it when asking Claude Code to match specific visual styles from the branding guide.

### 11.3 Session Management

Claude Code sessions have context limits. For a project this size:

- Use **focused sessions**: One session for API work, another for UI components, another for the diagram. Don't try to do everything in a single session.
- If a session gets long, start a new one and tell Claude Code: "I'm continuing work on the Equinix Pricing Tool. Read the CLAUDE.md for context. I need to work on [specific thing] next."
- The CLAUDE.md file (tip #5 above) is critical for multi-session continuity.

---

## 12. Future Enhancements (Out of Scope for V1)

These are explicitly NOT part of the initial build but documented for future consideration:

- Save/load project configurations (would require a backend database)
- PDF export of the network diagram
- Multi-user collaboration on a single pricing document
- Integration with Equinix Portal for direct ordering
- Historical pricing comparison
- Customer-specific discount tiers
- Presentation/slideshow mode for customer meetings

---

## Appendix A: Example Diagram Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │ Washington, D.C.     │         │ London               │     │
│  │                      │         │                      │     │
│  │ ┌──────────────────┐ │         │ ┌──────────────────┐ │     │
│  │ │■ Fabric Port     │ │         │ │■ Fabric Port     │ │     │
│  │ │  10G Redundant   │ │         │ │  10G Redundant   │ │     │
│  │ └──────────────────┘ │         │ └──────────────────┘ │     │
│  │                      │         │                      │     │
│  │ ┌──────────────────┐ │         │ ┌──────────────────┐ │     │
│  │ │■ Network Edge    │ │         │ │■ Internet Access │ │     │
│  │ │  Cisco 8000V     │ │─ ─ ─ ─ │ │  1 Gbps BGP      │ │     │
│  │ │  Medium, BYOL    │ │ EVPL_VC │ │                  │ │     │
│  │ └──────────────────┘ │         │ └──────────────────┘ │     │
│  │                      │         │                      │     │
│  │ ┌──────────────────┐ │         │                      │     │
│  │ │▓ AWS             │ │         │                      │     │
│  │ │  Direct Connect  │ │         │                      │     │
│  │ │  1 Gbps          │ │         │                      │     │
│  │ └──────────────────┘ │         │                      │     │
│  └──────────────────────┘         └──────────────────────┘     │
│                                                                 │
│  Legend:                                                        │
│  ── Equinix Fabric®  ─ ─ Virtual Connection                    │
│                                                                 │
│  ■ = Equinix Product (black bar)  ▓ = Cloud Provider (colored) │
└─────────────────────────────────────────────────────────────────┘
```

## Appendix B: Key Equinix API Response Examples

### B.1 Metros Response (`GET /fabric/v4/metros`)
```json
{
  "pagination": { "offset": 0, "limit": 20, "total": 60 },
  "data": [
    {
      "code": "DC",
      "name": "Washington, D.C.",
      "region": "AMER",
      "connectedMetros": [
        { "code": "NY", "avgLatency": 5.2 },
        { "code": "AT", "avgLatency": 8.1 }
      ]
    },
    {
      "code": "LD",
      "name": "London",
      "region": "EMEA",
      "connectedMetros": [
        { "code": "AM", "avgLatency": 4.8 },
        { "code": "FR", "avgLatency": 6.2 }
      ]
    }
  ]
}
```

### B.2 Pricing Search Response (`POST /fabric/v4/prices/search`)
```json
{
  "data": [
    {
      "type": "VIRTUAL_CONNECTION_PRODUCT",
      "code": "CONNECTION_50_MBPS",
      "name": "50 Mbps Connection",
      "description": "Virtual connection at 50 Mbps",
      "charges": [
        {
          "type": "MONTHLY_RECURRING",
          "price": 150.00,
          "currency": "USD"
        }
      ]
    }
  ]
}
```

### B.3 Network Edge Device Types Response (`GET /ne/v1/devices/types`)
```json
[
  {
    "deviceTypeCode": "CSR1000V",
    "name": "Cisco CSR 1000V",
    "vendor": "Cisco",
    "category": "ROUTER",
    "availableMetros": ["DC", "SV", "LD", "SG", "TY"],
    "softwarePackages": [
      {
        "code": "CSR_SEC",
        "name": "Security Package"
      }
    ],
    "coreCounts": [2, 4, 8, 16]
  },
  {
    "deviceTypeCode": "PA-VM",
    "name": "Palo Alto VM-Series",
    "vendor": "Palo Alto Networks",
    "category": "FIREWALL",
    "availableMetros": ["DC", "SV", "LD", "FR", "SG"],
    "coreCounts": [2, 4, 8]
  }
]
```

---

*This document was generated on 2026-02-24 from analysis of the Equinix Solution Diagrams PPTX branding guide and Equinix Developer API documentation.*
