import { describe, it, expect, beforeEach } from 'vitest';
import {
  setDefaultPricing,
  getDefaultPricing,
  hasDefaultPricing,
  lookupPortPrice,
  lookupVCPrice,
  lookupCloudRouterPrice,
  lookupNEPrice,
  lookupIbxForMetro,
  setDefaultLocations,
} from './defaultPricing';

const samplePricing = {
  fabricPorts: {
    '10G_STANDARD': { mrc: 1500, nrc: 0 },
    '1G_STANDARD': { mrc: 500, nrc: 0 },
  },
  virtualConnections: {
    '50': { mrc: 60, nrc: 0 },
    '1000': { mrc: 500, nrc: 0 },
  },
  cloudRouter: {
    STANDARD: { mrc: 350, nrc: 0 },
    PREMIUM: { mrc: 700, nrc: 0 },
  },
  networkEdge: {
    'CSR1000V_STD_12': { mrc: 200, nrc: 100 },
  },
  internetAccess: {},
};

describe('defaultPricing', () => {
  beforeEach(() => {
    // Reset by setting known state — module uses a singleton
    setDefaultPricing(null as unknown as typeof samplePricing);
    setDefaultLocations([]);
  });

  describe('setDefaultPricing / getDefaultPricing / hasDefaultPricing', () => {
    it('returns null and false before setting', () => {
      expect(getDefaultPricing()).toBeNull();
      expect(hasDefaultPricing()).toBe(false);
    });

    it('round-trips pricing data', () => {
      setDefaultPricing(samplePricing);
      expect(getDefaultPricing()).toBe(samplePricing);
      expect(hasDefaultPricing()).toBe(true);
    });
  });

  describe('lookupPortPrice', () => {
    beforeEach(() => setDefaultPricing(samplePricing));

    it('finds by label key (10G_STANDARD)', () => {
      expect(lookupPortPrice('10G', 'STANDARD')).toEqual({ mrc: 1500, nrc: 0 });
    });

    it('finds by Mbps string (10000 → 10G)', () => {
      expect(lookupPortPrice('10000', 'STANDARD')).toEqual({ mrc: 1500, nrc: 0 });
    });

    it('returns null for missing entry', () => {
      expect(lookupPortPrice('100G', 'STANDARD')).toBeNull();
    });

    it('returns null when pricing not loaded', () => {
      setDefaultPricing(null as unknown as typeof samplePricing);
      expect(lookupPortPrice('10G', 'STANDARD')).toBeNull();
    });
  });

  describe('lookupVCPrice', () => {
    beforeEach(() => setDefaultPricing(samplePricing));

    it('finds price by bandwidth Mbps', () => {
      expect(lookupVCPrice(1000)).toEqual({ mrc: 500, nrc: 0 });
    });

    it('returns null for missing bandwidth', () => {
      expect(lookupVCPrice(9999)).toBeNull();
    });
  });

  describe('lookupCloudRouterPrice', () => {
    beforeEach(() => setDefaultPricing(samplePricing));

    it('finds price by package code', () => {
      expect(lookupCloudRouterPrice('STANDARD')).toEqual({ mrc: 350, nrc: 0 });
    });

    it('returns null for missing package', () => {
      expect(lookupCloudRouterPrice('NONEXISTENT')).toBeNull();
    });
  });

  describe('lookupNEPrice', () => {
    beforeEach(() => setDefaultPricing(samplePricing));

    it('finds price by composite key', () => {
      expect(lookupNEPrice('CSR1000V', 'STD', 12)).toEqual({ mrc: 200, nrc: 100 });
    });

    it('returns null for missing entry', () => {
      expect(lookupNEPrice('CSR1000V', 'STD', 24)).toBeNull();
    });
  });

  describe('lookupIbxForMetro', () => {
    it('falls back to default reference IBX when no locations set', () => {
      expect(lookupIbxForMetro('DC')).toBe('DC6');
    });

    it('finds IBX for matching metro', () => {
      setDefaultLocations([
        { ibx: 'NY5', metroCode: 'NY' },
        { ibx: 'DC6', metroCode: 'DC' },
      ]);
      expect(lookupIbxForMetro('NY')).toBe('NY5');
    });

    it('falls back to reference IBX for unknown metro', () => {
      setDefaultLocations([{ ibx: 'NY5', metroCode: 'NY' }], 'SV1');
      expect(lookupIbxForMetro('XX')).toBe('SV1');
    });

    it('updates reference IBX via setDefaultLocations', () => {
      setDefaultLocations([], 'AT1');
      expect(lookupIbxForMetro('UNKNOWN')).toBe('AT1');
    });
  });
});
