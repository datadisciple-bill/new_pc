/**
 * Holds pricing data loaded from /data/defaults.json at app startup.
 * Mock functions check these lookups before falling back to hardcoded values.
 */

interface PriceEntry {
  mrc: number;
  nrc: number;
}

interface DefaultPricingData {
  fabricPorts: Record<string, PriceEntry>;
  virtualConnections: Record<string, PriceEntry>;
  cloudRouter: Record<string, PriceEntry>;
  networkEdge: Record<string, PriceEntry>;
}

interface EIALocationEntry {
  ibx: string;
  metroCode: string;
}

let pricing: DefaultPricingData | null = null;
let eiaLocations: EIALocationEntry[] = [];
let referenceIbx: string = 'DC6';

export function setDefaultPricing(data: DefaultPricingData): void {
  pricing = data;
}

export function setDefaultLocations(locations: EIALocationEntry[], ibx?: string): void {
  eiaLocations = locations ?? [];
  if (ibx) referenceIbx = ibx;
}

export function getDefaultPricing(): DefaultPricingData | null {
  return pricing;
}

export function hasDefaultPricing(): boolean {
  return pricing !== null;
}

/** Find an IBX code for a given metro. Falls back to the reference IBX. */
export function lookupIbxForMetro(metroCode: string): string {
  const match = eiaLocations.find((loc) => loc.metroCode === metroCode);
  return match?.ibx ?? referenceIbx;
}

/** Lookup Fabric Port price by bandwidth (Mbps or "10G" label) and package code */
export function lookupPortPrice(bandwidth: string, portProduct: string): PriceEntry | null {
  if (!pricing) return null;
  // Try the raw value first (might already be "10G" label or "10000" Mbps)
  const direct = pricing.fabricPorts[`${bandwidth}_${portProduct}`];
  if (direct) return direct;
  // Fetch script stores keys as "10G_STANDARD"; mock layer passes "10000" (Mbps).
  // Convert Mbps → label and retry.
  const bwNum = Number(bandwidth);
  if (!isNaN(bwNum) && bwNum >= 1000) {
    const label = `${bwNum / 1000}G`;
    return pricing.fabricPorts[`${label}_${portProduct}`] ?? null;
  }
  return null;
}

/** Lookup Virtual Connection price by bandwidth in Mbps */
export function lookupVCPrice(bandwidthMbps: number): PriceEntry | null {
  return pricing?.virtualConnections[String(bandwidthMbps)] ?? null;
}

/** Lookup Cloud Router price by package code (e.g. "STANDARD") */
export function lookupCloudRouterPrice(packageCode: string): PriceEntry | null {
  return pricing?.cloudRouter[packageCode] ?? null;
}

/** Lookup Network Edge price by device type, package code, and term length */
export function lookupNEPrice(
  deviceTypeCode: string,
  packageCode: string,
  termMonths: number
): PriceEntry | null {
  return pricing?.networkEdge[`${deviceTypeCode}_${packageCode}_${termMonths}`] ?? null;
}
