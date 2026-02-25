// User configuration types — what the user builds up in the app

export interface ProjectConfig {
  id: string;
  name: string;
  metros: MetroSelection[];
  connections: VirtualConnection[];
}

export interface MetroSelection {
  metroCode: string;
  metroName: string;
  region: string;
  services: ServiceSelection[];
}

export type ServiceType = 'FABRIC_PORT' | 'NETWORK_EDGE' | 'INTERNET_ACCESS' | 'CLOUD_ROUTER';

export interface ServiceSelection {
  id: string;
  type: ServiceType;
  config: FabricPortConfig | NetworkEdgeConfig | InternetAccessConfig | CloudRouterConfig;
  pricing: PricingResult | null;
}

export interface FabricPortConfig {
  speed: PortSpeed;
  type: 'SINGLE' | 'REDUNDANT';
  encapsulation: 'DOT1Q' | 'QINQ';
  quantity: number;
}

export type PortSpeed = '1G' | '10G' | '25G' | '50G' | '100G';

export interface CorePriceEntry {
  cores: number;
  mrc: number;
  nrc: number;
}

export interface NetworkEdgeConfig {
  deviceTypeCode: string;
  deviceTypeName: string;
  vendorName: string;
  packageCode: string;
  softwareVersion: string;
  licenseType: 'BYOL' | 'SUBSCRIPTION';
  redundant: boolean;
  termLength: 1 | 12 | 24 | 36;
  showPriceTable?: boolean;
  priceTable?: CorePriceEntry[] | null;
}

export interface InternetAccessConfig {
  bandwidthMbps: number;
  routingProtocol: 'STATIC' | 'DIRECT' | 'BGP';
  connectionType: 'SINGLE' | 'DUAL';
  deliveryMethod: 'FABRIC_PORT' | 'NETWORK_EDGE';
}

export interface CloudRouterConfig {
  package: 'STANDARD' | 'PREMIUM';
}

export interface VirtualConnection {
  id: string;
  name: string;
  type: 'EVPL_VC' | 'IP_VC';
  aSide: ConnectionEndpoint;
  zSide: ConnectionEndpoint;
  bandwidthMbps: number;
  redundant: boolean;
  pricing: PricingResult | null;
  showPriceTable: boolean;
  priceTable: BandwidthPriceEntry[] | null;
}

export interface BandwidthPriceEntry {
  bandwidthMbps: number;
  label: string;
  mrc: number;
  currency: string;
}

export type EndpointType = 'PORT' | 'NETWORK_EDGE' | 'CLOUD_ROUTER' | 'SERVICE_PROFILE';

export interface ConnectionEndpoint {
  metroCode: string;
  type: EndpointType;
  serviceId: string;
  serviceProfileName?: string;
}

export interface PricingResult {
  mrc: number;
  nrc: number;
  currency: string;
  isEstimate: boolean;
  breakdown: PricingBreakdownItem[];
}

export interface PricingBreakdownItem {
  description: string;
  mrc: number;
  nrc: number;
}
