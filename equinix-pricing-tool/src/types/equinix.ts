// Equinix API response types

export interface Metro {
  code: string;
  name: string;
  region: 'AMER' | 'EMEA' | 'APAC';
  connectedMetros: ConnectedMetro[];
}

export interface ConnectedMetro {
  code: string;
  avgLatency: number;
}

export interface MetrosResponse {
  pagination: Pagination;
  data: Metro[];
}

export interface Pagination {
  offset: number;
  limit: number;
  total: number;
}

export interface DeviceType {
  deviceTypeCode: string;
  name: string;
  vendor: string;
  category: 'ROUTER' | 'FIREWALL' | 'SDWAN' | 'OTHER';
  availableMetros: string[];
  softwarePackages: SoftwarePackage[];
  coreCounts: number[];
  coreMemoryMap?: Record<number, string>;
  availableLicenseTypes?: ('BYOL' | 'SUB')[];
}

export interface SoftwarePackage {
  code: string;
  name: string;
}

export interface ServiceProfile {
  uuid: string;
  name: string;
  type: string;
  description: string;
  visibility: string;
  accessPointTypeConfigs: AccessPointTypeConfig[];
}

export interface AccessPointTypeConfig {
  type: string;
  supportedBandwidths: number[];
}

export interface PriceSearchRequest {
  filter: {
    '/type': string;
    [key: string]: string | number | boolean;
  };
}

export interface PriceSearchResponse {
  data: PriceItem[];
}

export interface PriceItem {
  type: string;
  code: string;
  name: string;
  description: string;
  charges: PriceCharge[];
}

export interface PriceCharge {
  type: 'MONTHLY_RECURRING' | 'NON_RECURRING';
  price: number;
  currency: string;
}

export interface NetworkEdgePriceResponse {
  monthlyRecurring: number;
  nonRecurring: number;
  currency: string;
  termLength: number;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  token_timeout: number;
  user_name: string;
}

export interface EIALocation {
  ibx: string;
  metroCode: string;
  metroName: string;
  region: string;
}

export interface RouterPackage {
  code: string;
  name: string;
  description: string;
}

// --- Environment Import: raw API response types ---

export interface PortResponse {
  uuid: string;
  name: string;
  type: string;
  state: string;
  location: { metroCode: string; metroName: string };
  encapsulation: { type: 'DOT1Q' | 'QINQ' };
  physicalPortSpeed: number;
  physicalPortQuantity: number;
  redundancy: { enabled: boolean; group: string };
  account: { orgId: string };
}

export interface ConnectionResponse {
  uuid: string;
  name: string;
  type: 'EVPL_VC' | 'IP_VC' | 'EVPLAN_VC' | 'EPLAN_VC' | 'EVPTREE_VC' | 'EPTREE_VC';
  state: string;
  bandwidth: number;
  aSide: {
    accessPoint: {
      type: string;
      port?: { uuid: string };
      router?: { uuid: string };
      profile?: { uuid: string };
      location?: { metroCode: string };
    };
  };
  zSide: {
    accessPoint: {
      type: string;
      port?: { uuid: string };
      router?: { uuid: string };
      profile?: { uuid: string };
      location?: { metroCode: string };
    };
  };
  redundancy?: { group: string; priority: 'PRIMARY' | 'SECONDARY' };
}

export interface RouterResponse {
  uuid: string;
  name: string;
  state: string;
  location: { metroCode: string; metroName: string };
  package: { code: 'STANDARD' | 'PREMIUM' };
  order?: { purchaseOrderNumber: string };
}

export interface DeviceResponse {
  uuid: string;
  name: string;
  status: string;
  metroCode: string;
  deviceTypeCode: string;
  vendorName: string;
  packageCode: string;
  coreCount: number;
  softwareVersion: string;
  licenseType: 'BYOL' | 'SUBSCRIPTION';
  redundant: boolean;
  termLength: number;
}

export interface PaginatedResponse<T> {
  pagination: Pagination;
  data: T[];
}
