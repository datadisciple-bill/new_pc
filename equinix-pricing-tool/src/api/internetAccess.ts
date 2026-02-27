import { apiRequest } from './client';
import type { EIALocation } from '@/types/equinix';
import { useMockData } from './mock/useMock';
import { mockEIALocations, mockEIAPricing } from './mock/internetAccessMock';
import { lookupIbxForMetro } from '@/data/defaultPricing';

export interface EIAPricingResult {
  mrc: number;
  nrc: number;
  currency: string;
}

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

/**
 * Fetch EIA pricing via the v1 prices/search API.
 * connectionType: 'IA_VC' (Fabric/NE delivery) or 'IA_C' (Colocation delivery)
 * serviceType: 'SINGLE_PORT' or 'DUAL_PORT'
 */
export async function fetchEIAPricing(
  metroCode: string,
  connectionType: 'IA_VC' | 'IA_C',
  serviceType: 'SINGLE_PORT' | 'DUAL_PORT',
  bandwidthMbps: number
): Promise<EIAPricingResult> {
  if (useMockData()) return mockEIAPricing(connectionType, bandwidthMbps);

  const ibx = lookupIbxForMetro(metroCode);

  const body = {
    filter: {
      and: [
        { property: '/type', operator: '=', values: ['INTERNET_ACCESS_PRODUCT'] },
        { property: '/account/accountNumber', operator: '=', values: ['1'] },
        { property: '/service/type', operator: '=', values: [serviceType] },
        { property: '/service/bandwidth', operator: '=', values: [bandwidthMbps] },
        { property: '/service/billing', operator: '=', values: ['FIXED'] },
        { property: '/service/connection/type', operator: '=', values: [connectionType] },
        { property: '/service/connection/aSide/accessPoint/type', operator: '=', values: ['COLO'] },
        { property: '/service/connection/aSide/accessPoint/location/ibx', operator: '=', values: [ibx] },
        { property: '/service/useCase', operator: '=', values: ['MAIN'] },
      ],
    },
  };

  interface PriceCharge {
    type: string;
    price: number;
  }

  const response = await apiRequest<{
    data: Array<{ summary?: { charges?: PriceCharge[] } }>;
  }>('/internetAccess/v1/prices/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const charges = response.data?.[0]?.summary?.charges ?? [];
  const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
  const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;

  return { mrc, nrc, currency: 'USD' };
}
