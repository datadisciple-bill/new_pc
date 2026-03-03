import { describe, it, expect } from 'vitest';
import { getHardcodedVCPairPricing } from './vcPairDefaults';

const KEY_METROS = ['DC', 'NY', 'SV', 'CH', 'DA', 'LD', 'AM', 'FR', 'PA', 'SG', 'HK', 'MB', 'SP'];
const BANDWIDTHS = ['50', '100', '200', '500', '1000', '2000', '5000', '10000', '50000'];

describe('vcPairDefaults', () => {
  const pricing = getHardcodedVCPairPricing();

  it('has all 91 pairs (13 same-metro + 78 cross-metro)', () => {
    expect(Object.keys(pricing)).toHaveLength(91);
  });

  it('every pair has all 9 bandwidths', () => {
    for (const [pairKey, bwMap] of Object.entries(pricing)) {
      for (const bw of BANDWIDTHS) {
        expect(bwMap[bw], `${pairKey} missing bandwidth ${bw}`).toBeDefined();
      }
    }
  });

  it('all prices are positive numbers', () => {
    for (const [pairKey, bwMap] of Object.entries(pricing)) {
      for (const [bw, entry] of Object.entries(bwMap)) {
        expect(entry.mrc, `${pairKey}/${bw} mrc`).toBeGreaterThan(0);
        expect(entry.nrc, `${pairKey}/${bw} nrc`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('prices are symmetric (DC-LD === LD-DC key)', () => {
    // Keys are already lexicographically sorted, so DC|LD and LD|DC
    // both resolve to DC|LD. Verify the key exists for both orderings.
    const key1 = ['DC', 'LD'].sort().join('|');
    const key2 = ['LD', 'DC'].sort().join('|');
    expect(key1).toBe(key2);
    expect(pricing[key1]).toBeDefined();
  });

  it('same-metro prices < intra-region prices < cross-region prices at 1G', () => {
    const sameDC = pricing['DC|DC']['1000'].mrc;
    const intraAmerDCNY = pricing['DC|NY']['1000'].mrc;
    const crossDCLD = pricing['DC|LD']['1000'].mrc;

    expect(sameDC).toBeLessThan(intraAmerDCNY);
    expect(intraAmerDCNY).toBeLessThan(crossDCLD);
  });

  it('contains all 13 same-metro pairs', () => {
    for (const metro of KEY_METROS) {
      const key = `${metro}|${metro}`;
      expect(pricing[key], `missing same-metro pair ${key}`).toBeDefined();
    }
  });

  it('contains all 78 cross-metro pairs', () => {
    let count = 0;
    for (let i = 0; i < KEY_METROS.length; i++) {
      for (let j = i + 1; j < KEY_METROS.length; j++) {
        const key = [KEY_METROS[i], KEY_METROS[j]].sort().join('|');
        expect(pricing[key], `missing cross-metro pair ${key}`).toBeDefined();
        count++;
      }
    }
    expect(count).toBe(78);
  });

  it('returns the same cached instance on subsequent calls', () => {
    const a = getHardcodedVCPairPricing();
    const b = getHardcodedVCPairPricing();
    expect(a).toBe(b);
  });
});
