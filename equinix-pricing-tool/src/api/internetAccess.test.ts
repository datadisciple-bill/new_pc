import { describe, it, expect, vi } from 'vitest';

vi.mock('./mock/useMock', () => ({
  useMockData: vi.fn(() => true),
}));

vi.mock('./client', () => ({
  apiRequest: vi.fn(),
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
    it('always returns null (no pricing API)', async () => {
      const result = await fetchEIAPricing();
      expect(result).toBeNull();
    });
  });
});
