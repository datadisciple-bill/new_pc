import { apiRequest } from './client';
import { useConfigStore } from '@/store/configStore';
import type { MetrosResponse, Metro, PriceSearchResponse, ServiceProfile, RouterPackage } from '@/types/equinix';
import { useMockData } from './mock/useMock';
import { mockMetros, mockPriceSearch, mockServiceProfiles, mockRouterPackages } from './mock/fabricMock';

export async function fetchMetros(): Promise<Metro[]> {
  const cache = useConfigStore.getState().cache;
  if (cache.metrosLoaded) return cache.metros;

  if (useMockData()) {
    const metros = mockMetros();
    useConfigStore.getState().setMetros(metros);
    return metros;
  }

  const response = await apiRequest<MetrosResponse>('/fabric/v4/metros');
  useConfigStore.getState().setMetros(response.data);
  return response.data;
}

export async function fetchServiceProfiles(): Promise<ServiceProfile[]> {
  const cache = useConfigStore.getState().cache;
  if (cache.serviceProfilesLoaded) return cache.serviceProfiles;

  if (useMockData()) {
    const profiles = mockServiceProfiles();
    useConfigStore.getState().setServiceProfiles(profiles);
    return profiles;
  }

  const response = await apiRequest<{ data: ServiceProfile[] }>(
    '/fabric/v4/serviceProfiles'
  );
  useConfigStore.getState().setServiceProfiles(response.data);
  return response.data;
}

export async function fetchRouterPackages(): Promise<RouterPackage[]> {
  if (useMockData()) return mockRouterPackages();

  const response = await apiRequest<{ data: RouterPackage[] }>(
    '/fabric/v4/routerPackages'
  );
  return response.data;
}

type FilterValue = string | number | boolean;

/**
 * Build a Fabric v4 price search filter in the required {and: [...]} format.
 * Each property becomes a {property, operator, values} entry.
 */
function buildPriceFilter(
  filterType: string,
  properties: Record<string, FilterValue | FilterValue[]>
) {
  const conditions: Array<{ property: string; operator: string; values: FilterValue[] }> = [
    { property: '/type', operator: '=', values: [filterType] },
  ];
  for (const [prop, val] of Object.entries(properties)) {
    if (Array.isArray(val)) {
      conditions.push({ property: prop, operator: 'IN', values: val });
    } else {
      conditions.push({ property: prop, operator: '=', values: [val] });
    }
  }
  return { filter: { and: conditions } };
}

export async function searchPrices(
  filterType: string,
  properties: Record<string, FilterValue | FilterValue[]>
): Promise<PriceSearchResponse> {
  if (useMockData()) return mockPriceSearch(filterType, properties);

  const body = buildPriceFilter(filterType, properties);
  return apiRequest<PriceSearchResponse>('/fabric/v4/prices/search', {
    method: 'POST',
    body,
  });
}
