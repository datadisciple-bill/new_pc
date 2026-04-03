import { apiRequest } from './client';
import { useConfigStore } from '@/store/configStore';
import type { DeviceType, NetworkEdgePriceResponse, DeviceResponse, PaginatedResponse } from '@/types/equinix';
import { useMockData } from './mock/useMock';
import { mockDeviceTypes, mockNetworkEdgePricing, mockDevices } from './mock/networkEdgeMock';

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
  // Store normalizes availableMetros (objects → strings) automatically
  useConfigStore.getState().setDeviceTypes(types);
  return useConfigStore.getState().cache.deviceTypes;
}

export async function fetchDeviceTypesForMetro(_metroCode: string): Promise<DeviceType[]> {
  // All NE device types are assumed available at all Network Edge locations
  return fetchDeviceTypes();
}

export async function fetchNetworkEdgePricing(
  deviceTypeCode: string,
  coreCount: string,
  termLength: number,
  metroCode: string,
  softwarePackage?: string,
  licenseType?: string
): Promise<NetworkEdgePriceResponse> {
  if (useMockData()) {
    return mockNetworkEdgePricing(deviceTypeCode, coreCount, termLength);
  }

  const params: Record<string, string> = {
    vendorPackage: deviceTypeCode,
    core: coreCount,
    termLength: String(termLength),
    metro: metroCode,
  };
  if (softwarePackage) params.softwarePackage = softwarePackage;
  if (licenseType) params.licenseType = licenseType;
  const qs = new URLSearchParams(params);
  return apiRequest<NetworkEdgePriceResponse>(`/ne/v1/prices?${qs}`);
}

export async function fetchDevices(): Promise<DeviceResponse[]> {
  if (useMockData()) return mockDevices();

  const allDevices: DeviceResponse[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const response = await apiRequest<PaginatedResponse<DeviceResponse>>(
      `/ne/v1/devices?offset=${offset}&limit=100`
    );
    allDevices.push(...response.data);
    total = response.pagination.total;
    offset += response.data.length;
  }
  return allDevices;
}
