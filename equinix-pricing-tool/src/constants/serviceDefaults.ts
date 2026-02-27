import type { FabricPortConfig, NetworkEdgeConfig, InternetAccessConfig, CloudRouterConfig, ColocationConfig, NspConfig, CrossConnectConfig } from '@/types/config';

export const DEFAULT_FABRIC_PORT: FabricPortConfig = {
  speed: '10G',
  portProduct: 'STANDARD',
  type: 'PRIMARY',
  encapsulation: 'DOT1Q',
  quantity: 1,
};

export const DEFAULT_NETWORK_EDGE: NetworkEdgeConfig = {
  deviceTypeCode: '',
  deviceTypeName: '',
  vendorName: '',
  packageCode: '',
  softwareVersion: '',
  licenseType: 'BYOL',
  redundant: false,
  termLength: 1,
};

export const DEFAULT_INTERNET_ACCESS: InternetAccessConfig = {
  bandwidthMbps: 100,
  routingProtocol: 'BGP',
  connectionType: 'SINGLE',
  deliveryMethod: 'FABRIC_PORT',
};

export const DEFAULT_CLOUD_ROUTER: CloudRouterConfig = {
  package: 'STANDARD',
};

export const DEFAULT_COLOCATION: ColocationConfig = {
  description: 'Cage / Cabinet',
  mrcPrice: 0,
};

export const DEFAULT_NSP: NspConfig = {
  providerName: '',
};

export const DEFAULT_CROSS_CONNECT: CrossConnectConfig = {
  connectionService: 'SINGLE_MODE_FIBER',
  connectorType: 'LC',
  protocolType: '10 GigE',
  quantity: 1,
  mrcPrice: 0,
};

export const CROSS_CONNECT_MEDIA_TYPES = [
  { value: 'SINGLE_MODE_FIBER', label: 'Single Mode Fiber (SMF)' },
  { value: 'MULTI_MODE_FIBER', label: 'Multi Mode Fiber (MMF)' },
  { value: 'UTP', label: 'UTP (Copper)' },
  { value: 'COAX', label: 'Coaxial' },
] as const;

export const CROSS_CONNECT_CONNECTOR_TYPES = [
  { value: 'LC', label: 'LC' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
  { value: 'FC', label: 'FC' },
  { value: 'RJ45', label: 'RJ45' },
] as const;

export const CROSS_CONNECT_PROTOCOLS = [
  '10 GigE',
  'GigE',
  'Ethernet',
  'Dark Fiber',
  'Fibre Channel',
  '100G',
  '400G',
] as const;

export const PORT_SPEEDS = ['1G', '10G', '100G', '400G'] as const;

export const PORT_PRODUCTS = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'UNLIMITED', label: 'Unlimited' },
  { value: 'UNLIMITED_PLUS', label: 'Unlimited Plus' },
] as const;

export const BANDWIDTH_OPTIONS = [
  50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000,
] as const;

export const TERM_OPTIONS = [
  { value: 1, label: 'Month-to-Month' },
  { value: 12, label: '1 Year' },
  { value: 24, label: '2 Years' },
  { value: 36, label: '3 Years' },
] as const;

export const TERM_DISCOUNTS: Record<number, number> = {
  1: 0,
  12: 15,
  24: 25,
  36: 35,
};

export function getTermDiscountPercent(termLength: number): number {
  return TERM_DISCOUNTS[termLength] ?? 0;
}

export const CLOUD_SERVICE_PROFILES = [
  { name: 'AWS Direct Connect', provider: 'AWS' },
  { name: 'Azure ExpressRoute', provider: 'Microsoft Azure' },
  { name: 'Google Cloud Interconnect', provider: 'Google Cloud' },
  { name: 'Oracle FastConnect', provider: 'Oracle Cloud' },
  { name: 'IBM Cloud Direct Link', provider: 'IBM Cloud' },
  { name: 'Alibaba Cloud Express Connect', provider: 'Alibaba Cloud' },
] as const;
