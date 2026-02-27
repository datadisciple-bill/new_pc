import type { EIALocation } from '@/types/equinix';
import { lookupEIAPrice } from '@/data/defaultPricing';
import type { EIAPricingResult } from '../internetAccess';

export function mockEIAPricing(connectionType: string, bandwidthMbps: number): EIAPricingResult {
  const cached = lookupEIAPrice(connectionType, bandwidthMbps);
  if (cached) return { mrc: cached.mrc, nrc: cached.nrc, currency: 'USD' };

  // Rough estimate fallback: base $200 + $0.50/Mbps for IA_VC, $0.40/Mbps for IA_C
  const rate = connectionType === 'IA_C' ? 0.40 : 0.50;
  const mrc = Math.round(200 + bandwidthMbps * rate);
  return { mrc, nrc: 0, currency: 'USD' };
}

export function mockEIALocations(): EIALocation[] {
  return [
    { ibx: 'DC1', metroCode: 'DC', metroName: 'Washington, D.C.', region: 'AMER' },
    { ibx: 'DC2', metroCode: 'DC', metroName: 'Washington, D.C.', region: 'AMER' },
    { ibx: 'NY1', metroCode: 'NY', metroName: 'New York', region: 'AMER' },
    { ibx: 'NY5', metroCode: 'NY', metroName: 'New York', region: 'AMER' },
    { ibx: 'SV1', metroCode: 'SV', metroName: 'Silicon Valley', region: 'AMER' },
    { ibx: 'SV5', metroCode: 'SV', metroName: 'Silicon Valley', region: 'AMER' },
    { ibx: 'CH1', metroCode: 'CH', metroName: 'Chicago', region: 'AMER' },
    { ibx: 'DA1', metroCode: 'DA', metroName: 'Dallas', region: 'AMER' },
    { ibx: 'AT1', metroCode: 'AT', metroName: 'Atlanta', region: 'AMER' },
    { ibx: 'LA1', metroCode: 'LA', metroName: 'Los Angeles', region: 'AMER' },
    { ibx: 'LD4', metroCode: 'LD', metroName: 'London', region: 'EMEA' },
    { ibx: 'LD8', metroCode: 'LD', metroName: 'London', region: 'EMEA' },
    { ibx: 'AM3', metroCode: 'AM', metroName: 'Amsterdam', region: 'EMEA' },
    { ibx: 'FR5', metroCode: 'FR', metroName: 'Frankfurt', region: 'EMEA' },
    { ibx: 'SG1', metroCode: 'SG', metroName: 'Singapore', region: 'APAC' },
    { ibx: 'HK1', metroCode: 'HK', metroName: 'Hong Kong', region: 'APAC' },
    { ibx: 'TY2', metroCode: 'TY', metroName: 'Tokyo', region: 'APAC' },
    { ibx: 'SY4', metroCode: 'SY', metroName: 'Sydney', region: 'APAC' },
  ];
}
