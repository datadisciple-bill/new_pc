import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConfigStore } from '@/store/configStore';

vi.mock('./mock/useMock', () => ({
  useMockData: vi.fn(() => true),
}));

vi.mock('./client', () => ({
  apiRequest: vi.fn(),
}));

import { fetchDeviceTypes, fetchDeviceTypesForMetro, fetchNetworkEdgePricing } from './networkEdge';
import { useMockData } from './mock/useMock';
import { apiRequest } from './client';

describe('networkEdge API', () => {
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

  describe('fetchDeviceTypes', () => {
    it('returns cached device types when loaded', async () => {
      const cached = [
        { deviceTypeCode: 'CSR', name: 'Cisco', vendor: 'Cisco', category: 'ROUTER' as const, availableMetros: ['DC'], softwarePackages: [], coreCounts: [2] },
      ];
      useConfigStore.setState({
        cache: {
          metros: [],
          metrosLoaded: false,
          deviceTypes: cached,
          deviceTypesLoaded: true,
          serviceProfiles: [],
          serviceProfilesLoaded: false,
        },
      });

      const result = await fetchDeviceTypes();
      expect(result).toBe(cached);
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('uses mock data in mock mode', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchDeviceTypes();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('deviceTypeCode');
    });

    it('handles array response format from API', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      const mockTypes = [
        { deviceTypeCode: 'CSR', name: 'Cisco', vendor: 'Cisco', category: 'ROUTER', availableMetros: ['DC'], softwarePackages: [], coreCounts: [2] },
      ];
      vi.mocked(apiRequest).mockResolvedValueOnce(mockTypes);

      const result = await fetchDeviceTypes();
      expect(apiRequest).toHaveBeenCalledWith('/ne/v1/deviceTypes?limit=200');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles { data: [...] } response format from API', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      const mockTypes = [
        { deviceTypeCode: 'PA', name: 'PaloAlto', vendor: 'PaloAlto', category: 'FIREWALL', availableMetros: ['NY'], softwarePackages: [], coreCounts: [4] },
      ];
      vi.mocked(apiRequest).mockResolvedValueOnce({ data: mockTypes });

      const result = await fetchDeviceTypes();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('fetchDeviceTypesForMetro', () => {
    it('delegates to fetchDeviceTypes', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchDeviceTypesForMetro('DC');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('fetchNetworkEdgePricing', () => {
    it('returns mock pricing in mock mode', async () => {
      vi.mocked(useMockData).mockReturnValue(true);

      const result = await fetchNetworkEdgePricing('CSR1000V', '4', 12, 'DC');
      expect(result).toHaveProperty('monthlyRecurring');
      expect(result).toHaveProperty('nonRecurring');
      expect(result).toHaveProperty('currency');
    });

    it('builds correct query string in live mode', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      vi.mocked(apiRequest).mockResolvedValueOnce({
        monthlyRecurring: 500,
        nonRecurring: 100,
        currency: 'USD',
        termLength: 12,
      });

      await fetchNetworkEdgePricing('CSR1000V', '4', 12, 'DC');

      const callPath = vi.mocked(apiRequest).mock.calls[0][0];
      expect(callPath).toContain('/ne/v1/prices');
      expect(callPath).toContain('vendorPackage=CSR1000V');
      expect(callPath).toContain('core=4');
      expect(callPath).toContain('termLength=12');
      expect(callPath).toContain('metro=DC');
    });

    it('includes optional softwarePackage and licenseType params', async () => {
      vi.mocked(useMockData).mockReturnValue(false);
      vi.mocked(apiRequest).mockResolvedValueOnce({
        monthlyRecurring: 800,
        nonRecurring: 0,
        currency: 'USD',
        termLength: 1,
      });

      await fetchNetworkEdgePricing('PA-VM', '4', 1, 'NY', 'PA_NGFW', 'BYOL');

      const callPath = vi.mocked(apiRequest).mock.calls[0][0];
      expect(callPath).toContain('core=4');
      expect(callPath).toContain('softwarePackage=PA_NGFW');
      expect(callPath).toContain('licenseType=BYOL');
    });
  });
});
