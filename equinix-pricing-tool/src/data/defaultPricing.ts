/**
 * Holds pricing data loaded from /data/defaults.json at app startup.
 * Mock functions check these lookups before falling back to hardcoded values.
 */

import { getHardcodedVCPairPricing } from './vcPairDefaults';

interface PriceEntry {
  mrc: number;
  nrc: number;
}

interface DefaultPricingData {
  fabricPorts: Record<string, PriceEntry>;
  virtualConnections: Record<string, PriceEntry>;
  virtualConnectionPairs?: Record<string, Record<string, PriceEntry>>;
  cloudRouter: Record<string, PriceEntry>;
  networkEdge: Record<string, PriceEntry>;
  internetAccess: Record<string, PriceEntry>;
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

/** Lookup VC price for a specific metro pair and bandwidth. Returns null for uncached pairs. */
export function lookupVCPairPrice(
  aSide: string,
  zSide: string,
  bandwidthMbps: number
): PriceEntry | null {
  const key = [aSide, zSide].sort().join('|');
  const bwKey = String(bandwidthMbps);

  // Check defaults.json data first
  const fromDefaults = pricing?.virtualConnectionPairs?.[key]?.[bwKey];
  if (fromDefaults) return fromDefaults;

  // Fall back to hardcoded data
  const hardcoded = getHardcodedVCPairPricing();
  return hardcoded[key]?.[bwKey] ?? null;
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

/** Lookup EIA price by connection type (IA_VC or IA_C) and bandwidth in Mbps */
export function lookupEIAPrice(connectionType: string, bandwidthMbps: number): PriceEntry | null {
  return pricing?.internetAccess[`${connectionType}_FIXED_${bandwidthMbps}`] ?? null;
}
