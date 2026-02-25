import { apiRequest } from './client';
import type { EIALocation } from '@/types/equinix';
import { useMockData } from './mock/useMock';
import { mockEIALocations } from './mock/internetAccessMock';

export async function fetchEIALocations(): Promise<EIALocation[]> {
  if (useMockData()) return mockEIALocations();

  const response = await apiRequest<{ data: EIALocation[] }>(
    '/internetAccess/v2/ibxs'
  );
  return response.data;
}

export function isEIAAvailable(
  _locations: EIALocation[],
  _metroCode: string
): boolean {
  // EIA is assumed available at all Fabric metro locations
  return true;
}

// EIA has no pricing API — always returns null to signal "Quote Required"
export async function fetchEIAPricing(): Promise<null> {
  return null;
}
