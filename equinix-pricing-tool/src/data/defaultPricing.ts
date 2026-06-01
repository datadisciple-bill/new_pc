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
  // Reference (single-metro) tables — fallback when a per-metro lookup misses
  fabricPorts: Record<string, PriceEntry>;
  virtualConnections: Record<string, PriceEntry>;
  virtualConnectionPairs?: Record<string, Record<string, PriceEntry>>;
  cloudRouter: Record<string, PriceEntry>;
  networkEdge: Record<string, PriceEntry>;
  internetAccess: Record<string, PriceEntry>;
  // Per-metro tables for richer offline data (introduced for the Offline Data mode)
  fabricPortsByMetro?: Record<string, Record<string, PriceEntry>>;
  virtualConnectionsByMetro?: Record<string, Record<string, PriceEntry>>;
  cloudRouterByMetro?: Record<string, Record<string, PriceEntry>>;
  internetAccessByMetro?: Record<string, Record<string, PriceEntry>>;
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

/** Find the metro code that owns a given IBX, or null if unknown. */
export function lookupMetroForIbx(ibx: string): string | null {
  const match = eiaLocations.find((loc) => loc.ibx === ibx);
  return match?.metroCode ?? null;
}

/**
 * Lookup Fabric Port price by bandwidth (Mbps or "10G" label) and package code.
 * When `metro` is supplied, the per-metro table is checked first; the reference
 * table is used as a fallback so prior callers keep their behavior unchanged.
 */
export function lookupPortPrice(
  bandwidth: string,
  portProduct: string,
  metro?: string,
): PriceEntry | null {
  if (!pricing) return null;

  // Build candidate keys: raw value first (e.g. "10G"), then Mbps→label conversion (e.g. "10000" → "10G").
  const keys: string[] = [`${bandwidth}_${portProduct}`];
  const bwNum = Number(bandwidth);
  if (!isNaN(bwNum) && bwNum >= 1000) {
    keys.push(`${bwNum / 1000}G_${portProduct}`);
  }

  if (metro) {
    const perMetro = pricing.fabricPortsByMetro?.[metro];
    if (perMetro) {
      for (const k of keys) if (perMetro[k]) return perMetro[k];
    }
  }
  for (const k of keys) if (pricing.fabricPorts[k]) return pricing.fabricPorts[k];
  return null;
}

/**
 * Lookup Virtual Connection price by bandwidth in Mbps.
 * When `metro` is supplied (for same-metro VCs), per-metro pricing is checked first.
 */
export function lookupVCPrice(bandwidthMbps: number, metro?: string): PriceEntry | null {
  if (!pricing) return null;
  const key = String(bandwidthMbps);
  if (metro) {
    const perMetro = pricing.virtualConnectionsByMetro?.[metro]?.[key];
    if (perMetro) return perMetro;
  }
  return pricing.virtualConnections[key] ?? null;
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

/** Lookup Cloud Router price by package code (e.g. "STANDARD"), with optional metro. */
export function lookupCloudRouterPrice(packageCode: string, metro?: string): PriceEntry | null {
  if (!pricing) return null;
  if (metro) {
    const perMetro = pricing.cloudRouterByMetro?.[metro]?.[packageCode];
    if (perMetro) return perMetro;
  }
  return pricing.cloudRouter[packageCode] ?? null;
}

/** Lookup Network Edge price by device type, package code, and term length */
export function lookupNEPrice(
  deviceTypeCode: string,
  packageCode: string,
  termMonths: number
): PriceEntry | null {
  return pricing?.networkEdge[`${deviceTypeCode}_${packageCode}_${termMonths}`] ?? null;
}

/** Lookup EIA price by connection type (IA_VC or IA_C) and bandwidth in Mbps, with optional metro. */
export function lookupEIAPrice(
  connectionType: string,
  bandwidthMbps: number,
  metro?: string,
): PriceEntry | null {
  if (!pricing) return null;
  const key = `${connectionType}_FIXED_${bandwidthMbps}`;
  if (metro) {
    const perMetro = pricing.internetAccessByMetro?.[metro]?.[key];
    if (perMetro) return perMetro;
  }
  return pricing.internetAccess[key] ?? null;
}
