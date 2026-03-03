/**
 * Hardcoded per-metro-pair VC pricing for 13 key metros.
 *
 * 13 same-metro + C(13,2)=78 cross-metro = 91 pairs.
 * Each pair has 9 bandwidths (50M → 50G) with MRC/NRC.
 *
 * Keys are lexicographically sorted metro pairs: "AA|ZZ".
 * Prices are based on realistic distance-based multipliers applied to
 * base bandwidth prices. These serve as the default fallback when
 * defaults.json doesn't include real API-fetched pair pricing.
 */

const BASE_MRC: Record<number, number> = {
  50: 150,
  100: 250,
  200: 450,
  500: 900,
  1000: 1500,
  2000: 2800,
  5000: 5500,
  10000: 9000,
  50000: 35000,
};

const BANDWIDTHS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];

/**
 * Per-pair multiplier applied to BASE_MRC.
 * Sorted key format: "AA|ZZ" (lexicographic).
 */
const PAIR_MULTIPLIERS: Record<string, number> = {
  // ── Same-metro (13) ─────────────────────────────────────────────────────
  'AM|AM': 0.52,
  'CH|CH': 0.50,
  'DA|DA': 0.48,
  'DC|DC': 0.50,
  'FR|FR': 0.52,
  'HK|HK': 0.55,
  'LD|LD': 0.53,
  'MB|MB': 0.58,
  'NY|NY': 0.52,
  'PA|PA': 0.53,
  'SG|SG': 0.54,
  'SP|SP': 0.56,
  'SV|SV': 0.50,

  // ── Intra-AMER (C(5,2)=10) ─────────────────────────────────────────────
  'CH|DC': 0.90,
  'CH|DA': 0.88,
  'CH|NY': 0.92,
  'CH|SV': 1.05,
  'DA|DC': 0.93,
  'DA|NY': 0.95,
  'DA|SV': 0.98,
  'DC|NY': 0.85,
  'DC|SV': 1.05,
  'NY|SV': 1.02,

  // ── Intra-EMEA (C(4,2)=6) ──────────────────────────────────────────────
  'AM|FR': 0.85,
  'AM|LD': 0.87,
  'AM|PA': 0.90,
  'FR|LD': 0.88,
  'FR|PA': 0.86,
  'LD|PA': 0.90,

  // ── Intra-APAC (C(3,2)=3) ──────────────────────────────────────────────
  'HK|SG': 0.95,
  'HK|MB': 1.05,
  'MB|SG': 1.00,

  // ── AMER ↔ EMEA (5×4=20) ───────────────────────────────────────────────
  'CH|LD': 1.58,
  'CH|AM': 1.55,
  'CH|FR': 1.60,
  'CH|PA': 1.62,
  'DA|LD': 1.65,
  'DA|AM': 1.62,
  'DA|FR': 1.68,
  'DA|PA': 1.70,
  'DC|LD': 1.55,
  'DC|AM': 1.52,
  'DC|FR': 1.58,
  'DC|PA': 1.60,
  'LD|NY': 1.50,
  'AM|NY': 1.48,
  'FR|NY': 1.55,
  'NY|PA': 1.53,
  'LD|SV': 1.70,
  'AM|SV': 1.68,
  'FR|SV': 1.72,
  'PA|SV': 1.75,

  // ── AMER ↔ APAC (5×3=15) ───────────────────────────────────────────────
  'CH|SG': 2.05,
  'CH|HK': 2.00,
  'CH|MB': 2.10,
  'DA|SG': 2.10,
  'DA|HK': 2.05,
  'DA|MB': 2.15,
  'DC|SG': 2.00,
  'DC|HK': 1.95,
  'DC|MB': 2.05,
  'HK|NY': 1.90,
  'NY|SG': 1.95,
  'MB|NY': 2.00,
  'HK|SV': 1.80,
  'SG|SV': 1.85,
  'MB|SV': 1.95,

  // ── EMEA ↔ APAC (4×3=12) ───────────────────────────────────────────────
  'AM|SG': 1.78,
  'AM|HK': 1.75,
  'AM|MB': 1.80,
  'FR|SG': 1.80,
  'FR|HK': 1.78,
  'FR|MB': 1.72,
  'HK|LD': 1.82,
  'LD|SG': 1.85,
  'LD|MB': 1.70,
  'HK|PA': 1.85,
  'PA|SG': 1.88,
  'MB|PA': 1.75,

  // ── LATAM cross-region (SP × 12 other metros = 12) ─────────────────────
  'DC|SP': 1.45,
  'NY|SP': 1.48,
  'SP|SV': 1.60,
  'CH|SP': 1.50,
  'DA|SP': 1.52,
  'LD|SP': 1.85,
  'AM|SP': 1.82,
  'FR|SP': 1.88,
  'PA|SP': 1.90,
  'SG|SP': 2.40,
  'HK|SP': 2.35,
  'MB|SP': 2.20,
};

let _cached: Record<string, Record<string, { mrc: number; nrc: number }>> | null = null;

/** Returns hardcoded per-pair VC pricing data, structured identically to defaults.json format */
export function getHardcodedVCPairPricing(): Record<string, Record<string, { mrc: number; nrc: number }>> {
  if (_cached) return _cached;

  const result: Record<string, Record<string, { mrc: number; nrc: number }>> = {};

  for (const [pairKey, multiplier] of Object.entries(PAIR_MULTIPLIERS)) {
    // Ensure keys are lexicographically sorted (e.g. "AM|CH" not "CH|AM")
    const sortedKey = pairKey.split('|').sort().join('|');
    const bwMap: Record<string, { mrc: number; nrc: number }> = {};
    for (const bw of BANDWIDTHS) {
      bwMap[String(bw)] = {
        mrc: Math.round(BASE_MRC[bw] * multiplier),
        nrc: 0,
      };
    }
    result[sortedKey] = bwMap;
  }

  _cached = result;
  return result;
}
