import { describe, it, expect, vi } from 'vitest';

vi.mock('./mock/useMock', () => ({
  useMockData: vi.fn(() => true),
}));

vi.mock('./client', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/data/defaultPricing', () => ({
  lookupIbxForMetro: vi.fn(() => 'DC6'),
  lookupEIAPrice: vi.fn(() => null),
}));

import { fetchEIALocations, isEIAAvailable, fetchEIAPricing } from './internetAccess';
import { useMockData } from './mock/useMock';
import { apiRequest } from './client';

describe('internetAccess API', () => {
  describe('fetchEIALocations', () => {
    it('returns mock locations in mock mode', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchEIALocations();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('ibx');
      expect(result[0]).toHaveProperty('metroCode');
    });

    it('calls API in live mode', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      const mockLocations = [{ ibx: 'DC6', metroCode: 'DC', metroName: 'Washington', region: 'AMER' }];
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: mockLocations });

      const result = await fetchEIALocations();
      expect(apiRequest).toHaveBeenCalledWith(
        '/internetAccess/v2/ibxs?service.connection.type=IA_VC&limit=200'
      );
      expect(result).toEqual(mockLocations);
    });
  });

  describe('isEIAAvailable', () => {
    it('always returns true', () => {
      expect(isEIAAvailable([], 'DC')).toBe(true);
      expect(isEIAAvailable([], 'UNKNOWN')).toBe(true);
    });
  });

  describe('fetchEIAPricing', () => {
    it('returns mock pricing in mock mode', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchEIAPricing('DC', 'IA_VC', 'SINGLE_PORT', 100);
      expect(result).toHaveProperty('mrc');
      expect(result).toHaveProperty('nrc');
      expect(result).toHaveProperty('currency', 'USD');
      expect(result.mrc).toBeGreaterThan(0);
    });

    it('calls v1 prices/search API in live mode', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      vi.mocked(apiRequest).mockResolvedValueOnce({
        data: [{
          summary: {
            charges: [
              { type: 'MONTHLY_RECURRING', price: 500 },
              { type: 'NON_RECURRING', price: 100 },
            ],
          },
        }],
      });

      const result = await fetchEIAPricing('DC', 'IA_VC', 'SINGLE_PORT', 100);
      expect(apiRequest).toHaveBeenCalledWith(
        '/internetAccess/v1/prices/search',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toEqual({ mrc: 500, nrc: 100, currency: 'USD' });
    });

    it('uses IA_C connection type for colocation delivery', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      vi.mocked(apiRequest).mockResolvedValueOnce({
        data: [{ summary: { charges: [{ type: 'MONTHLY_RECURRING', price: 300 }] } }],
      });

      const result = await fetchEIAPricing('DC', 'IA_C', 'SINGLE_PORT', 500);
      const lastCall = vi.mocked(apiRequest).mock.calls.at(-1)!;
      const callBody = JSON.parse((lastCall[1] as { body: string }).body);
      const connTypeFilter = callBody.filter.and.find(
        (f: { property: string }) => f.property === '/service/connection/type'
      );
      expect(connTypeFilter.values).toEqual(['IA_C']);
      expect(result.mrc).toBe(300);
    });
  });
});
