/**
 * In-memory cache for Virtual Connection pricing by metro pair.
 *
 * Key: "aSide|zSide|bandwidthMbps" — normalized so the smaller metro
 * code always comes first (pricing is symmetric).
 *
 * Entries expire after 24 hours.
 */

interface CacheEntry {
  mrc: number;
  nrc: number;
  cachedAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function makeKey(a: string, z: string, bw: number): string {
  // Normalize direction — pricing is symmetric
  const [lo, hi] = a < z ? [a, z] : [z, a];
  return `${lo}|${hi}|${bw}`;
}

export function getCachedVCPrice(
  aSide: string,
  zSide: string,
  bandwidthMbps: number
): { mrc: number; nrc: number } | null {
  const entry = CACHE.get(makeKey(aSide, zSide, bandwidthMbps));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    CACHE.delete(makeKey(aSide, zSide, bandwidthMbps));
    return null;
  }
  return { mrc: entry.mrc, nrc: entry.nrc };
}

export function setCachedVCPrice(
  aSide: string,
  zSide: string,
  bandwidthMbps: number,
  mrc: number,
  nrc: number
): void {
  CACHE.set(makeKey(aSide, zSide, bandwidthMbps), { mrc, nrc, cachedAt: Date.now() });
}
