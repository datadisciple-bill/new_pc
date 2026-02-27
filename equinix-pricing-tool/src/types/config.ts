// User configuration types — what the user builds up in the app

export interface ProjectConfig {
  id: string;
  name: string;
  metros: MetroSelection[];
  connections: VirtualConnection[];
  textBoxes: TextBox[];
  localSites: LocalSite[];
  annotationMarkers: AnnotationMarker[];
}

export interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LocalSiteIcon = 'colocation' | 'network-edge' | 'fabric-port' | 'internet-access' | 'cloud-router' | 'building-corporate' | 'building-factory' | 'building-home' | 'people-user';

export interface LocalSite {
  id: string;
  name: string;
  description: string;
  icon: LocalSiteIcon;
  x: number;
  y: number;
}

export interface AnnotationMarker {
  id: string;
  number: number;
  x: number;
  y: number;
  color: string;
  text: string;
}

export interface MetroSelection {
  metroCode: string;
  metroName: string;
  region: string;
  services: ServiceSelection[];
}

export type ServiceType = 'FABRIC_PORT' | 'NETWORK_EDGE' | 'INTERNET_ACCESS' | 'CLOUD_ROUTER' | 'COLOCATION' | 'NSP';

export interface ServiceSelection {
  id: string;
  type: ServiceType;
  config: FabricPortConfig | NetworkEdgeConfig | InternetAccessConfig | CloudRouterConfig | ColocationConfig | NspConfig;
  pricing: PricingResult | null;
}

export interface FabricPortConfig {
  speed: PortSpeed;
  portProduct: PortProduct;
  type: 'PRIMARY' | 'SECONDARY' | 'REDUNDANT';
  encapsulation: 'DOT1Q' | 'QINQ';
  quantity: number;
}

export type PortSpeed = '1G' | '10G' | '100G' | '400G';
export type PortProduct = 'STANDARD' | 'UNLIMITED' | 'UNLIMITED_PLUS';

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
  deliveryMethod: 'FABRIC_PORT' | 'NETWORK_EDGE' | 'COLOCATION';
  showPriceTable?: boolean;
  priceTable?: BandwidthPriceEntry[] | null;
}

export interface CloudRouterConfig {
  package: 'STANDARD' | 'PREMIUM';
}

export interface ColocationConfig {
  description: string;
  mrcPrice: number;
}

export interface NspConfig {
  providerName: string;
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
  nrc?: number;
  currency: string;
}

export type EndpointType = 'PORT' | 'NETWORK_EDGE' | 'CLOUD_ROUTER' | 'SERVICE_PROFILE' | 'COLOCATION' | 'NSP' | 'LOCAL_SITE';

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
