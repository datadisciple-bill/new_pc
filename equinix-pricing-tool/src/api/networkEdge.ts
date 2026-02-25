import { apiRequest } from './client';
import { useConfigStore } from '@/store/configStore';
import type { DeviceType, NetworkEdgePriceResponse } from '@/types/equinix';
import { useMockData } from './mock/useMock';
import { mockDeviceTypes, mockNetworkEdgePricing } from './mock/networkEdgeMock';

export async function fetchDeviceTypes(): Promise<DeviceType[]> {
  const cache = useConfigStore.getState().cache;
  if (cache.deviceTypesLoaded) return cache.deviceTypes;

  if (useMockData()) {
    const types = mockDeviceTypes();
    useConfigStore.getState().setDeviceTypes(types);
    return types;
  }

  const response = await apiRequest<{ data: DeviceType[] } | DeviceType[]>('/ne/v1/deviceTypes?limit=200');
  const types = Array.isArray(response) ? response : response.data;
  useConfigStore.getState().setDeviceTypes(types);
  return types;
}

export async function fetchDeviceTypesForMetro(_metroCode: string): Promise<DeviceType[]> {
  // All NE device types are assumed available at all Network Edge locations
  return fetchDeviceTypes();
}

export async function fetchNetworkEdgePricing(
  deviceTypeCode: string,
  packageCode: string,
  termLength: number,
  metroCode: string
): Promise<NetworkEdgePriceResponse> {
  if (useMockData()) {
    return mockNetworkEdgePricing(deviceTypeCode, packageCode, termLength);
  }

  const qs = new URLSearchParams({
    vendorPackage: deviceTypeCode,
    softwarePackage: packageCode,
    termLength: String(termLength),
    metro: metroCode,
  });
  return apiRequest<NetworkEdgePriceResponse>(`/ne/v1/prices?${qs}`);
}
