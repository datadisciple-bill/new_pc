import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FABRIC_PORT,
  DEFAULT_NETWORK_EDGE,
  DEFAULT_INTERNET_ACCESS,
  DEFAULT_CLOUD_ROUTER,
  DEFAULT_COLOCATION,
  DEFAULT_NSP,
  PORT_SPEEDS,
  PORT_PRODUCTS,
  BANDWIDTH_OPTIONS,
  TERM_OPTIONS,
  getTermDiscountPercent,
  CLOUD_SERVICE_PROFILES,
} from './serviceDefaults';

describe('serviceDefaults', () => {
  describe('default configs', () => {
    it('has valid Fabric Port defaults', () => {
      expect(DEFAULT_FABRIC_PORT.speed).toBe('10G');
      expect(DEFAULT_FABRIC_PORT.portProduct).toBe('STANDARD');
      expect(DEFAULT_FABRIC_PORT.type).toBe('PRIMARY');
      expect(DEFAULT_FABRIC_PORT.quantity).toBe(1);
    });

    it('has valid Network Edge defaults', () => {
      expect(DEFAULT_NETWORK_EDGE.licenseType).toBe('SUBSCRIPTION');
      expect(DEFAULT_NETWORK_EDGE.redundant).toBe(false);
      expect(DEFAULT_NETWORK_EDGE.termLength).toBe(1);
    });

    it('has valid Internet Access defaults', () => {
      expect(DEFAULT_INTERNET_ACCESS.bandwidthMbps).toBe(100);
      expect(DEFAULT_INTERNET_ACCESS.routingProtocol).toBe('BGP');
    });

    it('has valid Cloud Router defaults', () => {
      expect(DEFAULT_CLOUD_ROUTER.package).toBe('STANDARD');
    });

    it('has valid Colocation defaults', () => {
      expect(DEFAULT_COLOCATION.mrcPrice).toBe(0);
    });

    it('has valid NSP defaults', () => {
      expect(DEFAULT_NSP.providerName).toBe('');
    });
  });

  describe('PORT_SPEEDS', () => {
    it('contains expected speeds', () => {
      expect(PORT_SPEEDS).toEqual(['1G', '10G', '100G', '400G']);
    });
  });

  describe('PORT_PRODUCTS', () => {
    it('has three products', () => {
      expect(PORT_PRODUCTS).toHaveLength(3);
      expect(PORT_PRODUCTS.map((p) => p.value)).toEqual(['STANDARD', 'UNLIMITED', 'UNLIMITED_PLUS']);
    });
  });

  describe('BANDWIDTH_OPTIONS', () => {
    it('contains ascending bandwidths from 50 to 50000', () => {
      expect(BANDWIDTH_OPTIONS[0]).toBe(50);
      expect(BANDWIDTH_OPTIONS[BANDWIDTH_OPTIONS.length - 1]).toBe(50000);
      for (let i = 1; i < BANDWIDTH_OPTIONS.length; i++) {
        expect(BANDWIDTH_OPTIONS[i]).toBeGreaterThan(BANDWIDTH_OPTIONS[i - 1]);
      }
    });
  });

  describe('TERM_OPTIONS', () => {
    it('has four term lengths', () => {
      expect(TERM_OPTIONS).toHaveLength(4);
      expect(TERM_OPTIONS.map((t) => t.value)).toEqual([1, 12, 24, 36]);
    });
  });

  describe('getTermDiscountPercent', () => {
    it('returns 0 for month-to-month', () => {
      expect(getTermDiscountPercent(1)).toBe(0);
    });

    it('returns 15 for 1 year', () => {
      expect(getTermDiscountPercent(12)).toBe(15);
    });

    it('returns 25 for 2 years', () => {
      expect(getTermDiscountPercent(24)).toBe(25);
    });

    it('returns 35 for 3 years', () => {
      expect(getTermDiscountPercent(36)).toBe(35);
    });

    it('returns 0 for unknown term', () => {
      expect(getTermDiscountPercent(6)).toBe(0);
    });
  });

  describe('CLOUD_SERVICE_PROFILES', () => {
    it('includes major cloud providers', () => {
      const names = CLOUD_SERVICE_PROFILES.map((p) => p.name);
      expect(names).toContain('AWS Direct Connect');
      expect(names).toContain('Azure ExpressRoute');
      expect(names).toContain('Google Cloud Interconnect');
    });
  });
});
