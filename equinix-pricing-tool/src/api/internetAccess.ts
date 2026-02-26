import { apiRequest } from './client';
import type { EIALocation } from '@/types/equinix';
import { useMockData } from './mock/useMock';
import { mockEIALocations } from './mock/internetAccessMock';

export async function fetchEIALocations(): Promise<EIALocation[]> {
  if (useMockData()) return mockEIALocations();

  // service.connection.type is required: IA_VC = virtual (Fabric port), IA_C = dedicated
  const response = await apiRequest<{ data: EIALocation[] }>(
    '/internetAccess/v2/ibxs?service.connection.type=IA_VC&limit=200'
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
