import type { DeviceType, NetworkEdgePriceResponse } from '@/types/equinix';

export function mockDeviceTypes(): DeviceType[] {
  return [
    {
      deviceTypeCode: 'CSR1000V',
      name: 'Cisco CSR 1000V',
      vendor: 'Cisco',
      category: 'ROUTER',
      availableMetros: ['DC', 'NY', 'SV', 'CH', 'DA', 'AT', 'LA', 'LD', 'AM', 'FR', 'SG', 'HK', 'TY', 'SY'],
      softwarePackages: [{ code: 'CSR_SEC', name: 'Security Package' }, { code: 'CSR_APPX', name: 'Application Experience' }],
      coreCounts: [2, 4, 8, 16],
    },
    {
      deviceTypeCode: 'C8000V',
      name: 'Cisco Catalyst 8000V',
      vendor: 'Cisco',
      category: 'ROUTER',
      availableMetros: ['DC', 'NY', 'SV', 'CH', 'DA', 'LD', 'AM', 'FR', 'SG', 'TY'],
      softwarePackages: [{ code: 'C8_DNA', name: 'DNA Essentials' }, { code: 'C8_DNA_ADV', name: 'DNA Advantage' }],
      coreCounts: [2, 4, 8],
    },
    {
      deviceTypeCode: 'PA-VM',
      name: 'Palo Alto VM-Series',
      vendor: 'Palo Alto Networks',
      category: 'FIREWALL',
      availableMetros: ['DC', 'NY', 'SV', 'CH', 'DA', 'LD', 'FR', 'SG', 'TY', 'HK'],
      softwarePackages: [{ code: 'PA_NGFW', name: 'NGFW Bundle' }, { code: 'PA_THREAT', name: 'Threat Prevention' }],
      coreCounts: [2, 4, 8],
    },
    {
      deviceTypeCode: 'FG-VM',
      name: 'Fortinet FortiGate VM',
      vendor: 'Fortinet',
      category: 'FIREWALL',
      availableMetros: ['DC', 'NY', 'SV', 'LD', 'FR', 'AM', 'SG', 'TY', 'SY'],
      softwarePackages: [{ code: 'FG_UTM', name: 'UTM Bundle' }, { code: 'FG_ENT', name: 'Enterprise Bundle' }],
      coreCounts: [2, 4, 8, 16],
    },
    {
      deviceTypeCode: 'VSRX',
      name: 'Juniper vSRX',
      vendor: 'Juniper',
      category: 'FIREWALL',
      availableMetros: ['DC', 'NY', 'SV', 'LD', 'FR', 'SG', 'TY'],
      softwarePackages: [{ code: 'VSRX_STD', name: 'Standard' }, { code: 'VSRX_ADV', name: 'Advanced' }],
      coreCounts: [2, 4, 8],
    },
    {
      deviceTypeCode: 'AVIATRIX',
      name: 'Aviatrix Transit Gateway',
      vendor: 'Aviatrix',
      category: 'SDWAN',
      availableMetros: ['DC', 'NY', 'SV', 'CH', 'LD', 'FR', 'AM', 'SG', 'TY'],
      softwarePackages: [{ code: 'AVX_ADV', name: 'Advanced Networking' }],
      coreCounts: [2, 4],
    },
    {
      deviceTypeCode: 'VERSA-SDWAN',
      name: 'Versa SD-WAN',
      vendor: 'Versa Networks',
      category: 'SDWAN',
      availableMetros: ['DC', 'NY', 'SV', 'DA', 'LD', 'FR', 'SG'],
      softwarePackages: [{ code: 'VERSA_TITAN', name: 'Titan' }],
      coreCounts: [2, 4, 8],
    },
    {
      deviceTypeCode: 'VSRX3',
      name: 'Juniper vSRX 3.0',
      vendor: 'Juniper',
      category: 'FIREWALL',
      availableMetros: ['DC', 'NY', 'SV', 'LD', 'FR', 'SG'],
      softwarePackages: [{ code: 'VSRX3_STD', name: 'Standard' }],
      coreCounts: [2, 4, 8, 16],
    },
  ];
}

// Pricing based on core count tiers — realistic mock prices
const CORE_PRICE_MAP: Record<number, { base: number; subscription: number }> = {
  2: { base: 250, subscription: 350 },
  4: { base: 500, subscription: 700 },
  8: { base: 950, subscription: 1300 },
  16: { base: 1800, subscription: 2500 },
};

const TERM_DISCOUNT: Record<number, number> = {
  1: 1.0,
  12: 0.85,
  24: 0.75,
  36: 0.65,
};

export function mockNetworkEdgePricing(
  _deviceTypeCode: string,
  packageCode: string,
  termLength: number
): NetworkEdgePriceResponse {
  // Extract core count from package code, default to 4
  const coreMatch = packageCode.match(/(\d+)/);
  const cores = coreMatch ? parseInt(coreMatch[1], 10) : 4;
  const priceEntry = CORE_PRICE_MAP[cores] ?? CORE_PRICE_MAP[4];
  const discount = TERM_DISCOUNT[termLength] ?? 1.0;
  const mrc = Math.round(priceEntry.subscription * discount);

  return {
    monthlyRecurring: mrc,
    nonRecurring: termLength === 1 ? 0 : 500,
    currency: 'USD',
    termLength,
  };
}
