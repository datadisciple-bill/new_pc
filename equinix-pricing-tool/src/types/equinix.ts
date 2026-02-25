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
