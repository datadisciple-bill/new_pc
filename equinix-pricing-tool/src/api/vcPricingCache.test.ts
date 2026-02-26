import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getCachedVCPrice, setCachedVCPrice } from './vcPricingCache';

describe('vcPricingCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for cache miss', () => {
    expect(getCachedVCPrice('DC', 'NY', 1000)).toBeNull();
  });

  it('round-trips set and get', () => {
    setCachedVCPrice('DC', 'NY', 1000, 500, 100);
    const result = getCachedVCPrice('DC', 'NY', 1000);
    expect(result).toEqual({ mrc: 500, nrc: 100 });
  });

  it('normalizes key direction (a→z same as z→a)', () => {
    setCachedVCPrice('NY', 'DC', 500, 200, 50);
    // Query in reverse order should hit same entry
    const result = getCachedVCPrice('DC', 'NY', 500);
    expect(result).toEqual({ mrc: 200, nrc: 50 });
  });

  it('differentiates by bandwidth', () => {
    setCachedVCPrice('DC', 'NY', 1000, 500, 100);
    setCachedVCPrice('DC', 'NY', 5000, 2000, 200);
    expect(getCachedVCPrice('DC', 'NY', 1000)).toEqual({ mrc: 500, nrc: 100 });
    expect(getCachedVCPrice('DC', 'NY', 5000)).toEqual({ mrc: 2000, nrc: 200 });
  });

  it('returns null after TTL expires', () => {
    setCachedVCPrice('DC', 'NY', 1000, 500, 100);
    expect(getCachedVCPrice('DC', 'NY', 1000)).not.toBeNull();

    // Advance past 24-hour TTL
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(getCachedVCPrice('DC', 'NY', 1000)).toBeNull();
  });
});
