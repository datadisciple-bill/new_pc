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

let pricing: DefaultPricingData | null = null;

export function setDefaultPricing(data: DefaultPricingData): void {
  pricing = data;
}

export function hasDefaultPricing(): boolean {
  return pricing !== null;
}

/** Lookup Fabric Port price by speed (e.g. "10G") and type ("SINGLE"/"REDUNDANT") */
export function lookupPortPrice(speed: string, portType: string): PriceEntry | null {
  return pricing?.fabricPorts[`${speed}_${portType}`] ?? null;
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
