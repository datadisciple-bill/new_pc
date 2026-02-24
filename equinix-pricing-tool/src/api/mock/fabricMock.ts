import type { Metro, PriceSearchResponse, ServiceProfile, RouterPackage } from '@/types/equinix';

export function mockMetros(): Metro[] {
  return [
    { code: 'DC', name: 'Washington, D.C.', region: 'AMER', connectedMetros: [{ code: 'NY', avgLatency: 5.2 }, { code: 'AT', avgLatency: 8.1 }, { code: 'CH', avgLatency: 7.4 }] },
    { code: 'NY', name: 'New York', region: 'AMER', connectedMetros: [{ code: 'DC', avgLatency: 5.2 }, { code: 'CH', avgLatency: 12.3 }, { code: 'LD', avgLatency: 35.0 }] },
    { code: 'SV', name: 'Silicon Valley', region: 'AMER', connectedMetros: [{ code: 'LA', avgLatency: 4.1 }, { code: 'SE', avgLatency: 8.5 }, { code: 'TY', avgLatency: 55.0 }] },
    { code: 'CH', name: 'Chicago', region: 'AMER', connectedMetros: [{ code: 'DC', avgLatency: 7.4 }, { code: 'NY', avgLatency: 12.3 }, { code: 'DA', avgLatency: 10.0 }] },
    { code: 'DA', name: 'Dallas', region: 'AMER', connectedMetros: [{ code: 'CH', avgLatency: 10.0 }, { code: 'AT', avgLatency: 9.5 }, { code: 'LA', avgLatency: 15.2 }] },
    { code: 'AT', name: 'Atlanta', region: 'AMER', connectedMetros: [{ code: 'DC', avgLatency: 8.1 }, { code: 'DA', avgLatency: 9.5 }, { code: 'MI', avgLatency: 6.8 }] },
    { code: 'LA', name: 'Los Angeles', region: 'AMER', connectedMetros: [{ code: 'SV', avgLatency: 4.1 }, { code: 'DA', avgLatency: 15.2 }] },
    { code: 'SE', name: 'Seattle', region: 'AMER', connectedMetros: [{ code: 'SV', avgLatency: 8.5 }] },
    { code: 'MI', name: 'Miami', region: 'AMER', connectedMetros: [{ code: 'AT', avgLatency: 6.8 }] },
    { code: 'SP', name: 'São Paulo', region: 'AMER', connectedMetros: [{ code: 'MI', avgLatency: 62.0 }] },
    { code: 'LD', name: 'London', region: 'EMEA', connectedMetros: [{ code: 'AM', avgLatency: 4.8 }, { code: 'FR', avgLatency: 6.2 }, { code: 'NY', avgLatency: 35.0 }] },
    { code: 'AM', name: 'Amsterdam', region: 'EMEA', connectedMetros: [{ code: 'LD', avgLatency: 4.8 }, { code: 'FR', avgLatency: 3.5 }] },
    { code: 'FR', name: 'Frankfurt', region: 'EMEA', connectedMetros: [{ code: 'LD', avgLatency: 6.2 }, { code: 'AM', avgLatency: 3.5 }, { code: 'PA', avgLatency: 5.1 }] },
    { code: 'PA', name: 'Paris', region: 'EMEA', connectedMetros: [{ code: 'FR', avgLatency: 5.1 }, { code: 'LD', avgLatency: 5.5 }] },
    { code: 'SG', name: 'Singapore', region: 'APAC', connectedMetros: [{ code: 'HK', avgLatency: 18.5 }, { code: 'TY', avgLatency: 36.0 }, { code: 'SY', avgLatency: 48.0 }] },
    { code: 'HK', name: 'Hong Kong', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 18.5 }, { code: 'TY', avgLatency: 25.0 }] },
    { code: 'TY', name: 'Tokyo', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 36.0 }, { code: 'HK', avgLatency: 25.0 }, { code: 'SV', avgLatency: 55.0 }] },
    { code: 'SY', name: 'Sydney', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 48.0 }] },
    { code: 'OS', name: 'Osaka', region: 'APAC', connectedMetros: [{ code: 'TY', avgLatency: 4.2 }] },
    { code: 'MB', name: 'Mumbai', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 32.0 }] },
  ];
}

// Realistic pricing based on type
const PRICING: Record<string, { mrc: number; nrc: number }> = {
  // Fabric Ports
  'PORT_1G_SINGLE': { mrc: 250, nrc: 0 },
  'PORT_1G_REDUNDANT': { mrc: 500, nrc: 0 },
  'PORT_10G_SINGLE': { mrc: 1500, nrc: 0 },
  'PORT_10G_REDUNDANT': { mrc: 3000, nrc: 0 },
  'PORT_25G_SINGLE': { mrc: 2500, nrc: 0 },
  'PORT_25G_REDUNDANT': { mrc: 5000, nrc: 0 },
  'PORT_50G_SINGLE': { mrc: 4500, nrc: 0 },
  'PORT_50G_REDUNDANT': { mrc: 9000, nrc: 0 },
  'PORT_100G_SINGLE': { mrc: 7500, nrc: 0 },
  'PORT_100G_REDUNDANT': { mrc: 15000, nrc: 0 },
  // Virtual Connections (by bandwidth)
  'VC_50': { mrc: 150, nrc: 0 },
  'VC_100': { mrc: 250, nrc: 0 },
  'VC_200': { mrc: 450, nrc: 0 },
  'VC_500': { mrc: 900, nrc: 0 },
  'VC_1000': { mrc: 1500, nrc: 0 },
  'VC_2000': { mrc: 2800, nrc: 0 },
  'VC_5000': { mrc: 5500, nrc: 0 },
  'VC_10000': { mrc: 9000, nrc: 0 },
  // Cloud Router
  'FCR_STANDARD': { mrc: 450, nrc: 0 },
  'FCR_PREMIUM': { mrc: 900, nrc: 0 },
};

export function mockPriceSearch(
  filterType: string,
  properties: Record<string, string | number | boolean>
): PriceSearchResponse {
  let key = '';

  switch (filterType) {
    case 'VIRTUAL_PORT_PRODUCT': {
      const speed = properties['/port/bandwidth'] ?? '10G';
      const portType = properties['/port/type'] ?? 'SINGLE';
      key = `PORT_${speed}_${portType}`;
      break;
    }
    case 'VIRTUAL_CONNECTION_PRODUCT': {
      const bw = properties['/connection/bandwidth'] ?? 1000;
      key = `VC_${bw}`;
      break;
    }
    case 'CLOUD_ROUTER_PRODUCT': {
      const pkg = properties['/router/package/code'] ?? 'STANDARD';
      key = `FCR_${pkg}`;
      break;
    }
    default:
      key = 'VC_1000';
  }

  const pricing = PRICING[key] ?? { mrc: 500, nrc: 0 };

  return {
    data: [
      {
        type: filterType,
        code: key,
        name: key.replace(/_/g, ' '),
        description: `Mock pricing for ${key}`,
        charges: [
          { type: 'MONTHLY_RECURRING', price: pricing.mrc, currency: 'USD' },
          ...(pricing.nrc > 0
            ? [{ type: 'NON_RECURRING' as const, price: pricing.nrc, currency: 'USD' }]
            : []),
        ],
      },
    ],
  };
}

export function mockServiceProfiles(): ServiceProfile[] {
  return [
    {
      uuid: 'aws-dx-profile',
      name: 'AWS Direct Connect',
      type: 'L2_PROFILE',
      description: 'AWS Direct Connect service profile',
      visibility: 'PUBLIC',
      accessPointTypeConfigs: [{ type: 'COLO', supportedBandwidths: [50, 100, 200, 500, 1000, 2000, 5000, 10000] }],
    },
    {
      uuid: 'azure-er-profile',
      name: 'Azure ExpressRoute',
      type: 'L2_PROFILE',
      description: 'Microsoft Azure ExpressRoute service profile',
      visibility: 'PUBLIC',
      accessPointTypeConfigs: [{ type: 'COLO', supportedBandwidths: [50, 100, 200, 500, 1000, 2000, 5000, 10000] }],
    },
    {
      uuid: 'gcp-ic-profile',
      name: 'Google Cloud Interconnect',
      type: 'L2_PROFILE',
      description: 'Google Cloud Interconnect service profile',
      visibility: 'PUBLIC',
      accessPointTypeConfigs: [{ type: 'COLO', supportedBandwidths: [50, 100, 200, 500, 1000, 2000, 10000] }],
    },
    {
      uuid: 'oracle-fc-profile',
      name: 'Oracle FastConnect',
      type: 'L2_PROFILE',
      description: 'Oracle Cloud FastConnect service profile',
      visibility: 'PUBLIC',
      accessPointTypeConfigs: [{ type: 'COLO', supportedBandwidths: [1000, 2000, 5000, 10000] }],
    },
    {
      uuid: 'ibm-dl-profile',
      name: 'IBM Cloud Direct Link',
      type: 'L2_PROFILE',
      description: 'IBM Cloud Direct Link service profile',
      visibility: 'PUBLIC',
      accessPointTypeConfigs: [{ type: 'COLO', supportedBandwidths: [50, 100, 200, 500, 1000, 2000, 5000] }],
    },
    {
      uuid: 'alibaba-ec-profile',
      name: 'Alibaba Cloud Express Connect',
      type: 'L2_PROFILE',
      description: 'Alibaba Cloud Express Connect service profile',
      visibility: 'PUBLIC',
      accessPointTypeConfigs: [{ type: 'COLO', supportedBandwidths: [50, 100, 200, 500, 1000, 2000, 5000, 10000] }],
    },
  ];
}

export function mockRouterPackages(): RouterPackage[] {
  return [
    { code: 'LAB', name: 'Lab', description: 'Lab package for testing' },
    { code: 'STANDARD', name: 'Standard', description: 'Standard routing package' },
    { code: 'ADVANCED', name: 'Advanced', description: 'Advanced routing with larger route tables' },
    { code: 'PREMIUM', name: 'Premium', description: 'Premium routing with full feature set' },
  ];
}
