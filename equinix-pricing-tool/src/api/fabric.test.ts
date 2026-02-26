import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConfigStore } from '@/store/configStore';

vi.mock('./mock/useMock', () => ({
  useMockData: vi.fn(() => true),
}));

vi.mock('./client', () => ({
  apiRequest: vi.fn(),
}));

import { fetchMetros, fetchServiceProfiles, fetchRouterPackages, searchPrices } from './fabric';
import { useMockData } from './mock/useMock';
import { apiRequest } from './client';

describe('fabric API', () => {
  beforeEach(() => {
    useConfigStore.setState({
      auth: { token: 'test', tokenExpiry: Date.now() + 3600000, isAuthenticated: true, userName: 'test' },
      cache: {
        metros: [],
        metrosLoaded: false,
        deviceTypes: [],
        deviceTypesLoaded: false,
        serviceProfiles: [],
        serviceProfilesLoaded: false,
      },
    });
    vi.clearAllMocks();
  });

  describe('fetchMetros', () => {
    it('returns cached metros when already loaded', async () => {
      const cachedMetros = [{ code: 'DC', name: 'DC', region: 'AMER' as const, connectedMetros: [] }];
      useConfigStore.setState({
        cache: {
          metros: cachedMetros,
          metrosLoaded: true,
          deviceTypes: [],
          deviceTypesLoaded: false,
          serviceProfiles: [],
          serviceProfilesLoaded: false,
        },
      });

      const result = await fetchMetros();
      expect(result).toBe(cachedMetros);
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('uses mock data when mock mode is on', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchMetros();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('code');
      // Should have stored in cache
      expect(useConfigStore.getState().cache.metrosLoaded).toBe(true);
    });

    it('calls API in live mode', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      const mockData = [{ code: 'NY', name: 'New York', region: 'AMER', connectedMetros: [] }];
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: mockData });

      const result = await fetchMetros();
      expect(apiRequest).toHaveBeenCalledWith('/fabric/v4/metros');
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchServiceProfiles', () => {
    it('returns cached profiles when loaded', async () => {
      const cached = [{ uuid: 'sp1', name: 'AWS', type: 'L2', description: '', visibility: 'PUBLIC', accessPointTypeConfigs: [] }];
      useConfigStore.setState({
        cache: {
          metros: [],
          metrosLoaded: false,
          deviceTypes: [],
          deviceTypesLoaded: false,
          serviceProfiles: cached,
          serviceProfilesLoaded: true,
        },
      });

      const result = await fetchServiceProfiles();
      expect(result).toBe(cached);
    });

    it('uses mock data in mock mode', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchServiceProfiles();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
    });

    it('calls API in live mode', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      const mockProfiles = [{ uuid: 'sp1', name: 'Test', type: 'L2', description: '', visibility: 'PUBLIC', accessPointTypeConfigs: [] }];
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: mockProfiles });

      const result = await fetchServiceProfiles();
      expect(apiRequest).toHaveBeenCalledWith('/fabric/v4/serviceProfiles');
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('fetchRouterPackages', () => {
    it('returns mock packages in mock mode', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchRouterPackages();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('code');
    });

    it('calls API in live mode', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      const mockPkgs = [{ code: 'STD', name: 'Standard', description: '' }];
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: mockPkgs });

      const result = await fetchRouterPackages();
      expect(result).toEqual(mockPkgs);
    });
  });

  describe('searchPrices', () => {
    it('uses mock data in mock mode', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await searchPrices('VIRTUAL_PORT_PRODUCT', {
        '/port/bandwidth': 10000,
      });
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('builds correct filter body in live mode', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: [] });

      await searchPrices('VIRTUAL_PORT_PRODUCT', {
        '/port/bandwidth': 10000,
        '/port/type': 'XF_PORT',
      });

      expect(apiRequest).toHaveBeenCalledWith('/fabric/v4/prices/search', {
        method: 'POST',
        body: {
          filter: {
            and: [
              { property: '/type', operator: '=', values: ['VIRTUAL_PORT_PRODUCT'] },
              { property: '/port/bandwidth', operator: '=', values: [10000] },
              { property: '/port/type', operator: '=', values: ['XF_PORT'] },
            ],
          },
        },
      });
    });

    it('uses IN operator for array values', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: [] });

      await searchPrices('VIRTUAL_PORT_PRODUCT', {
        '/port/bandwidth': [1000, 10000],
      });

      const body = vi.mocked(apiRequest).mock.calls[0][1]?.body as { filter: { and: Array<{ operator: string; property: string }> } };
      const bwFilter = body.filter.and.find((f) => f.property === '/port/bandwidth');
      expect(bwFilter?.operator).toBe('IN');
    });
  });
});
