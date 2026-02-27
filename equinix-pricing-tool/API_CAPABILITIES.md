# Equinix API Capabilities for Presales

## What You Can Quote and Price Programmatically

| Product | API | Pricing Available? | Key Details |
|---|---|---|---|
| **Fabric Ports** | Fabric v4 | **Yes** | MRC + NRC by port speed (1G–100G), package (Standard/Premium), term (1/12/24/36 mo), metro |
| **Virtual Connections** | Fabric v4 | **Yes** | MRC + NRC by connection type (EVPL, EPL, IP_VC), bandwidth (50M–50G), A-side/Z-side metro |
| **Fabric Cloud Router** | Fabric v4 | **Yes** | MRC + NRC by package (Lab/Standard), metro, term length |
| **Network Edge Devices** | NE v1 | **Yes** | MRC by device type, software package, core count, license, term length, metro. Supports HA pair pricing. |
| **Internet Access (EIA)** | EIA v1 | **Yes** | MRC + NRC by bandwidth (50M–10G), billing model (fixed/usage/burst), connection type, IBX |
| **Cross Connects** | Colocations v2 | **No** | No pricing endpoint — use manual pricing or contract rates |
| **IP Blocks** | Fabric v4 | **Yes** | MRC + NRC by prefix length and location |
| **Precision Time (NTP/PTP)** | Fabric v4 | **Yes** | MRC + NRC by package (Standard/Enterprise) |

## How This Helps You Sell

### 1. Instant Customer Quotes

The pricing APIs let you build real-time quotes without waiting on internal pricing teams. Show a customer exactly what their Fabric Port + Virtual Connection to AWS will cost in their chosen metro, at different term lengths and bandwidths, in a single meeting.

### 2. Multi-Cloud Solution Design

The Fabric v4 API has pre-built connection models for every major cloud provider — AWS, Azure, GCP, Oracle, IBM, Alibaba, SAP, Salesforce. You can validate a customer's cloud provider auth key and check VLAN availability *before* placing an order, reducing failed provisioning.

### 3. "What If" Scenarios with Dry Run

Fabric v4 supports `dryRun` on connection, port, router, and network creation. You can validate a full solution design and get price estimates without provisioning anything — perfect for customer demos and proposal building.

### 4. Network Edge Device Discovery

The NE API returns all available virtual device types (routers, firewalls, SD-WAN) with their available metros, software packages, core options, and management types. You can show customers exactly which vendors and appliances are available at their chosen location and price each configuration on the spot.

### 5. Metro & Latency Data

The Metros endpoint returns inter-metro latency measurements. Use this to help customers choose optimal locations for latency-sensitive workloads and justify multi-metro architectures.

### 6. EIA Configuration Eligibility

The EIA v1 API provides endpoints that tell you exactly which bandwidth tiers, routing protocols, and port options are valid for a given IBX — preventing invalid configurations before you present them to a customer.

## What You Can Provision Through the APIs

Once a deal closes, the same APIs support the full service lifecycle:

- **Fabric Ports** — Create single ports or LAG groups at any metro
- **Virtual Connections** — Provision connections between colos, to cloud providers, to Network Edge devices, or through Fabric Cloud Router
- **Cloud Routers** — Deploy FCR instances with BGP routing, route filters, and route aggregation
- **Network Edge Devices** — Deploy virtual appliances with ACLs, VPN, BGP peering, device links, backup/restore
- **Internet Access** — Order EIA services (dedicated or virtual)
- **Cross Connects** — Order physical cross connects with diverse/redundant options (up to 10 per order)

## Key Limitations to Know

- **Cross Connect pricing** is not available via API — you'll need contract rates or manual quoting
- **EIA pricing** is only in the v1 API (not v2), and requires an account number
- **Network Edge pricing** is per-configuration only — no bulk "show me all prices" endpoint
- **No published rate limits** — target max 5 requests/sec with backoff on 429 errors
