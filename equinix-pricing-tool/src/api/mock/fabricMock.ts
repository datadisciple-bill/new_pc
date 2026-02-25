import type { Metro, PriceSearchResponse, ServiceProfile, RouterPackage } from '@/types/equinix';
import { lookupPortPrice, lookupVCPrice, lookupCloudRouterPrice } from '@/data/defaultPricing';

export function mockMetros(): Metro[] {
  return [
    // AMER
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
    { code: 'DX', name: 'Denver', region: 'AMER', connectedMetros: [{ code: 'DA', avgLatency: 11.0 }, { code: 'CH', avgLatency: 13.0 }] },
    { code: 'TR', name: 'Toronto', region: 'AMER', connectedMetros: [{ code: 'NY', avgLatency: 8.0 }, { code: 'CH', avgLatency: 10.0 }] },
    { code: 'MT', name: 'Montreal', region: 'AMER', connectedMetros: [{ code: 'TR', avgLatency: 5.0 }, { code: 'NY', avgLatency: 9.0 }] },
    { code: 'BO', name: 'Bogota', region: 'AMER', connectedMetros: [{ code: 'MI', avgLatency: 40.0 }] },
    { code: 'MX', name: 'Mexico City', region: 'AMER', connectedMetros: [{ code: 'DA', avgLatency: 20.0 }, { code: 'MI', avgLatency: 28.0 }] },
    { code: 'RJ', name: 'Rio de Janeiro', region: 'AMER', connectedMetros: [{ code: 'SP', avgLatency: 5.0 }] },
    { code: 'CL', name: 'Cali', region: 'AMER', connectedMetros: [{ code: 'BO', avgLatency: 8.0 }] },
    { code: 'PH', name: 'Phoenix', region: 'AMER', connectedMetros: [{ code: 'LA', avgLatency: 6.0 }, { code: 'DA', avgLatency: 12.0 }] },
    { code: 'MN', name: 'Minneapolis', region: 'AMER', connectedMetros: [{ code: 'CH', avgLatency: 6.0 }] },
    // EMEA
    { code: 'LD', name: 'London', region: 'EMEA', connectedMetros: [{ code: 'AM', avgLatency: 4.8 }, { code: 'FR', avgLatency: 6.2 }, { code: 'NY', avgLatency: 35.0 }] },
    { code: 'AM', name: 'Amsterdam', region: 'EMEA', connectedMetros: [{ code: 'LD', avgLatency: 4.8 }, { code: 'FR', avgLatency: 3.5 }] },
    { code: 'FR', name: 'Frankfurt', region: 'EMEA', connectedMetros: [{ code: 'LD', avgLatency: 6.2 }, { code: 'AM', avgLatency: 3.5 }, { code: 'PA', avgLatency: 5.1 }] },
    { code: 'PA', name: 'Paris', region: 'EMEA', connectedMetros: [{ code: 'FR', avgLatency: 5.1 }, { code: 'LD', avgLatency: 5.5 }] },
    { code: 'ZH', name: 'Zurich', region: 'EMEA', connectedMetros: [{ code: 'FR', avgLatency: 3.0 }, { code: 'ML', avgLatency: 4.0 }] },
    { code: 'ML', name: 'Milan', region: 'EMEA', connectedMetros: [{ code: 'ZH', avgLatency: 4.0 }, { code: 'FR', avgLatency: 6.0 }] },
    { code: 'MA', name: 'Madrid', region: 'EMEA', connectedMetros: [{ code: 'PA', avgLatency: 8.0 }, { code: 'LD', avgLatency: 10.0 }] },
    { code: 'SK', name: 'Stockholm', region: 'EMEA', connectedMetros: [{ code: 'AM', avgLatency: 12.0 }, { code: 'HE', avgLatency: 5.0 }] },
    { code: 'HE', name: 'Helsinki', region: 'EMEA', connectedMetros: [{ code: 'SK', avgLatency: 5.0 }] },
    { code: 'WA', name: 'Warsaw', region: 'EMEA', connectedMetros: [{ code: 'FR', avgLatency: 8.0 }] },
    { code: 'DU', name: 'Dubai', region: 'EMEA', connectedMetros: [{ code: 'MB', avgLatency: 18.0 }, { code: 'FR', avgLatency: 45.0 }] },
    { code: 'SO', name: 'Sofia', region: 'EMEA', connectedMetros: [{ code: 'FR', avgLatency: 12.0 }] },
    { code: 'IL', name: 'Istanbul', region: 'EMEA', connectedMetros: [{ code: 'SO', avgLatency: 5.0 }, { code: 'DU', avgLatency: 20.0 }] },
    { code: 'BA', name: 'Barcelona', region: 'EMEA', connectedMetros: [{ code: 'MA', avgLatency: 4.0 }, { code: 'PA', avgLatency: 7.0 }] },
    { code: 'DB', name: 'Dublin', region: 'EMEA', connectedMetros: [{ code: 'LD', avgLatency: 5.0 }] },
    { code: 'MU', name: 'Munich', region: 'EMEA', connectedMetros: [{ code: 'FR', avgLatency: 2.5 }, { code: 'ZH', avgLatency: 3.5 }] },
    { code: 'LS', name: 'Lisbon', region: 'EMEA', connectedMetros: [{ code: 'MA', avgLatency: 4.0 }] },
    { code: 'JB', name: 'Johannesburg', region: 'EMEA', connectedMetros: [{ code: 'LD', avgLatency: 70.0 }] },
    { code: 'LA', name: 'Lagos', region: 'EMEA', connectedMetros: [{ code: 'JB', avgLatency: 35.0 }] },
    // APAC
    { code: 'SG', name: 'Singapore', region: 'APAC', connectedMetros: [{ code: 'HK', avgLatency: 18.5 }, { code: 'TY', avgLatency: 36.0 }, { code: 'SY', avgLatency: 48.0 }] },
    { code: 'HK', name: 'Hong Kong', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 18.5 }, { code: 'TY', avgLatency: 25.0 }] },
    { code: 'TY', name: 'Tokyo', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 36.0 }, { code: 'HK', avgLatency: 25.0 }, { code: 'SV', avgLatency: 55.0 }] },
    { code: 'SY', name: 'Sydney', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 48.0 }, { code: 'ME', avgLatency: 8.0 }] },
    { code: 'OS', name: 'Osaka', region: 'APAC', connectedMetros: [{ code: 'TY', avgLatency: 4.2 }] },
    { code: 'MB', name: 'Mumbai', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 32.0 }, { code: 'CH', avgLatency: 28.0 }] },
    { code: 'SL', name: 'Seoul', region: 'APAC', connectedMetros: [{ code: 'TY', avgLatency: 15.0 }, { code: 'HK', avgLatency: 20.0 }] },
    { code: 'ME', name: 'Melbourne', region: 'APAC', connectedMetros: [{ code: 'SY', avgLatency: 8.0 }] },
    { code: 'PE', name: 'Perth', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 30.0 }, { code: 'SY', avgLatency: 25.0 }] },
    { code: 'KL', name: 'Kuala Lumpur', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 5.0 }] },
    { code: 'JK', name: 'Jakarta', region: 'APAC', connectedMetros: [{ code: 'SG', avgLatency: 10.0 }] },
    { code: 'CH', name: 'Chennai', region: 'APAC', connectedMetros: [{ code: 'MB', avgLatency: 12.0 }, { code: 'SG', avgLatency: 22.0 }] },
  ];
}

// Metro region lookup for distance-based VC pricing
const METRO_REGIONS: Record<string, string> = {
  DC: 'AMER', NY: 'AMER', SV: 'AMER', CH: 'AMER', DA: 'AMER', AT: 'AMER',
  LA: 'AMER', SE: 'AMER', MI: 'AMER', SP: 'AMER', DX: 'AMER', TR: 'AMER',
  MT: 'AMER', BO: 'AMER', MX: 'AMER', RJ: 'AMER', CL: 'AMER', PH: 'AMER', MN: 'AMER',
  LD: 'EMEA', AM: 'EMEA', FR: 'EMEA', PA: 'EMEA', ZH: 'EMEA', ML: 'EMEA',
  MA: 'EMEA', SK: 'EMEA', HE: 'EMEA', WA: 'EMEA', DU: 'EMEA', SO: 'EMEA',
  IL: 'EMEA', BA: 'EMEA', DB: 'EMEA', MU: 'EMEA', LS: 'EMEA', JB: 'EMEA',
  SG: 'APAC', HK: 'APAC', TY: 'APAC', SY: 'APAC', OS: 'APAC', MB: 'APAC',
  SL: 'APAC', ME: 'APAC', PE: 'APAC', KL: 'APAC', JK: 'APAC',
};

/**
 * Returns a price multiplier based on the "distance" between two metros.
 * Same region uses a lower multiplier; cross-region uses a higher one.
 * Adjacent metros within a region get a slight bump; far-flung cross-region gets a bigger one.
 */
function getMetroPairMultiplier(aSide: string, zSide: string): number {
  if (!aSide || !zSide || aSide === zSide) return 0; // same metro = free (handled upstream)
  const aRegion = METRO_REGIONS[aSide];
  const zRegion = METRO_REGIONS[zSide];
  if (!aRegion || !zRegion) return 1;
  if (aRegion === zRegion) return 1; // intra-region: base price
  // Cross-region multipliers
  const pair = [aRegion, zRegion].sort().join('-');
  switch (pair) {
    case 'AMER-EMEA': return 1.5;
    case 'AMER-APAC': return 2.0;
    case 'APAC-EMEA': return 1.8;
    default: return 1.5;
  }
}

// Realistic pricing based on type
// Port prices are per-port; redundant pairs are 2x the single port price in the app layer.
// Key format: PORT_{bandwidthMbps}_{product}
const PRICING: Record<string, { mrc: number; nrc: number }> = {
  // Fabric Ports — Standard
  'PORT_1000_STANDARD': { mrc: 250, nrc: 0 },
  'PORT_10000_STANDARD': { mrc: 1500, nrc: 0 },
  'PORT_100000_STANDARD': { mrc: 7500, nrc: 0 },
  'PORT_400000_STANDARD': { mrc: 22500, nrc: 0 },
  // Fabric Ports — Unlimited
  'PORT_1000_UNLIMITED': { mrc: 500, nrc: 0 },
  'PORT_10000_UNLIMITED': { mrc: 3000, nrc: 0 },
  'PORT_100000_UNLIMITED': { mrc: 15000, nrc: 0 },
  'PORT_400000_UNLIMITED': { mrc: 45000, nrc: 0 },
  // Fabric Ports — Unlimited Plus
  'PORT_1000_UNLIMITED_PLUS': { mrc: 750, nrc: 0 },
  'PORT_10000_UNLIMITED_PLUS': { mrc: 4500, nrc: 0 },
  'PORT_100000_UNLIMITED_PLUS': { mrc: 22500, nrc: 0 },
  'PORT_400000_UNLIMITED_PLUS': { mrc: 67500, nrc: 0 },
  // Virtual Connections (by bandwidth)
  'VC_50': { mrc: 150, nrc: 0 },
  'VC_100': { mrc: 250, nrc: 0 },
  'VC_200': { mrc: 450, nrc: 0 },
  'VC_500': { mrc: 900, nrc: 0 },
  'VC_1000': { mrc: 1500, nrc: 0 },
  'VC_2000': { mrc: 2800, nrc: 0 },
  'VC_5000': { mrc: 5500, nrc: 0 },
  'VC_10000': { mrc: 9000, nrc: 0 },
  'VC_50000': { mrc: 35000, nrc: 0 },
  // Cloud Router
  'FCR_STANDARD': { mrc: 450, nrc: 0 },
  'FCR_PREMIUM': { mrc: 900, nrc: 0 },
};

export function mockPriceSearch(
  filterType: string,
  properties: Record<string, string | number | boolean | (string | number | boolean)[]>
): PriceSearchResponse {
  let key = '';
  let price = { mrc: 500, nrc: 0 };

  switch (filterType) {
    case 'VIRTUAL_PORT_PRODUCT': {
      const bw = Number(properties['/port/bandwidth'] ?? 10000);
      const product = String(properties['/port/package/code'] ?? 'STANDARD');
      key = `PORT_${bw}_${product}`;
      price = lookupPortPrice(String(bw), product) ?? PRICING[key] ?? price;
      break;
    }
    case 'VIRTUAL_CONNECTION_PRODUCT': {
      const bw = Number(properties['/connection/bandwidth'] ?? 1000);
      const aSide = String(properties['/connection/aSide/accessPoint/location/metroCode'] ?? '');
      const zSide = String(properties['/connection/zSide/accessPoint/location/metroCode'] ?? '');
      key = `VC_${bw}`;
      const basePrice = lookupVCPrice(bw) ?? PRICING[key] ?? price;
      // Apply distance multiplier for cross-metro connections
      const multiplier = getMetroPairMultiplier(aSide, zSide);
      price = { mrc: Math.round(basePrice.mrc * multiplier), nrc: basePrice.nrc };
      break;
    }
    case 'CLOUD_ROUTER_PRODUCT': {
      const pkg = String(properties['/router/package/code'] ?? 'STANDARD');
      key = `FCR_${pkg}`;
      price = lookupCloudRouterPrice(pkg) ?? PRICING[key] ?? price;
      break;
    }
    default:
      key = 'VC_1000';
      price = PRICING[key] ?? price;
  }

  return {
    data: [
      {
        type: filterType,
        code: key,
        name: key.replace(/_/g, ' '),
        description: `Pricing for ${key}`,
        charges: [
          { type: 'MONTHLY_RECURRING', price: price.mrc, currency: 'USD' },
          ...(price.nrc > 0
            ? [{ type: 'NON_RECURRING' as const, price: price.nrc, currency: 'USD' }]
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
