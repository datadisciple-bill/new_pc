import { describe, it, expect } from 'vitest';
import { mockMetros, mockPriceSearch, mockServiceProfiles } from './fabricMock';

describe('fabricMock', () => {
  describe('mockMetros', () => {
    it('returns a list of metros', () => {
      const metros = mockMetros();
      expect(metros.length).toBeGreaterThan(10);
      expect(metros[0]).toHaveProperty('code');
      expect(metros[0]).toHaveProperty('name');
      expect(metros[0]).toHaveProperty('region');
      expect(metros[0]).toHaveProperty('connectedMetros');
    });

    it('includes key metros', () => {
      const metros = mockMetros();
      const codes = metros.map((m) => m.code);
      expect(codes).toContain('DC');
      expect(codes).toContain('NY');
      expect(codes).toContain('LD');
      expect(codes).toContain('SG');
      expect(codes).toContain('TY');
    });

    it('has all three regions', () => {
      const metros = mockMetros();
      const regions = new Set(metros.map((m) => m.region));
      expect(regions).toContain('AMER');
      expect(regions).toContain('EMEA');
      expect(regions).toContain('APAC');
    });
  });

  describe('mockPriceSearch', () => {
    it('returns pricing for fabric ports', () => {
      const result = mockPriceSearch('VIRTUAL_PORT_PRODUCT', {
        '/port/type': 'XF_PORT',
        '/port/bandwidth': 10000,
        '/port/package/code': 'STANDARD',
        '/port/connectivitySource/type': 'COLO',
        '/port/settings/buyout': false,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].charges.length).toBeGreaterThan(0);
      const mrc = result.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING');
      expect(mrc?.price).toBe(1500);
    });

    it('returns pricing for virtual connections', () => {
      const result = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
      });
      const mrc = result.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING');
      expect(mrc?.price).toBe(1500);
    });

    it('returns pricing for cloud router', () => {
      const result = mockPriceSearch('CLOUD_ROUTER_PRODUCT', {
        '/router/package/code': 'PREMIUM',
      });
      const mrc = result.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING');
      expect(mrc?.price).toBe(900);
    });

    it('falls back to default pricing for unknown filter', () => {
      const result = mockPriceSearch('UNKNOWN', {});
      expect(result.data).toHaveLength(1);
    });

    it('DC-LD costs more than DC-NY at 1G (transatlantic > short-haul)', () => {
      const dcLd = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
        '/connection/aSide/accessPoint/location/metroCode': 'DC',
        '/connection/zSide/accessPoint/location/metroCode': 'LD',
        '/connection/zSide/accessPoint/type': 'COLO',
      });
      const dcNy = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
        '/connection/aSide/accessPoint/location/metroCode': 'DC',
        '/connection/zSide/accessPoint/location/metroCode': 'NY',
        '/connection/zSide/accessPoint/type': 'COLO',
      });
      const dcLdMrc = dcLd.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING')!.price;
      const dcNyMrc = dcNy.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING')!.price;
      expect(dcLdMrc).toBeGreaterThan(dcNyMrc);
    });

    it('DC-LD differs from DA-LD (per-pair differentiation)', () => {
      const dcLd = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
        '/connection/aSide/accessPoint/location/metroCode': 'DC',
        '/connection/zSide/accessPoint/location/metroCode': 'LD',
        '/connection/zSide/accessPoint/type': 'COLO',
      });
      const daLd = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
        '/connection/aSide/accessPoint/location/metroCode': 'DA',
        '/connection/zSide/accessPoint/location/metroCode': 'LD',
        '/connection/zSide/accessPoint/type': 'COLO',
      });
      const dcLdMrc = dcLd.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING')!.price;
      const daLdMrc = daLd.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING')!.price;
      expect(dcLdMrc).not.toBe(daLdMrc);
    });

    it('same-metro price < cross-metro price', () => {
      const dcDc = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
        '/connection/aSide/accessPoint/location/metroCode': 'DC',
        '/connection/zSide/accessPoint/location/metroCode': 'DC',
        '/connection/zSide/accessPoint/type': 'COLO',
      });
      const dcLd = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
        '/connection/aSide/accessPoint/location/metroCode': 'DC',
        '/connection/zSide/accessPoint/location/metroCode': 'LD',
        '/connection/zSide/accessPoint/type': 'COLO',
      });
      const dcDcMrc = dcDc.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING')!.price;
      const dcLdMrc = dcLd.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING')!.price;
      expect(dcDcMrc).toBeLessThan(dcLdMrc);
    });

    it('uncached pair (AT-SE) falls back to region multiplier', () => {
      const atSe = mockPriceSearch('VIRTUAL_CONNECTION_PRODUCT', {
        '/connection/bandwidth': 1000,
        '/connection/aSide/accessPoint/location/metroCode': 'AT',
        '/connection/zSide/accessPoint/location/metroCode': 'SE',
        '/connection/zSide/accessPoint/type': 'COLO',
      });
      const mrc = atSe.data[0].charges.find((c) => c.type === 'MONTHLY_RECURRING')!.price;
      // AT and SE are both AMER — intra-region multiplier is 1.0, so base price = 1500
      expect(mrc).toBe(1500);
    });
  });

  describe('mockServiceProfiles', () => {
    it('returns cloud provider profiles', () => {
      const profiles = mockServiceProfiles();
      expect(profiles.length).toBeGreaterThan(3);
      const names = profiles.map((p) => p.name);
      expect(names).toContain('AWS Direct Connect');
      expect(names).toContain('Azure ExpressRoute');
      expect(names).toContain('Google Cloud Interconnect');
    });
  });
});
