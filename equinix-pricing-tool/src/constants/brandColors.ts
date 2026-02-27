// Equinix branding color palette — from Equinix Solution Diagrams PPTX

export const EQUINIX_COLORS = {
  black: '#000000',
  annotationText: '#33A85C',
  annotationArrow: '#00A85F',
  numberedMarker: '#E91C24',
  lightGray: '#F4F4F4',
  darkNavy: '#1B2A34',
  white: '#FFFFFF',
} as const;

export const CLOUD_PROVIDER_COLORS: Record<string, string> = {
  'AWS': '#FF9900',
  'Microsoft Azure': '#0067B8',
  'Google Cloud': '#0070F2',
  'Oracle Cloud': '#ED1C23',
  'IBM Cloud': '#0070F2',
  'Alibaba Cloud': '#FE8720',
  'SAP': '#0070F2',
  'Salesforce': '#139CD9',
  'Office 365': '#D83B01',
} as const;

export const PARTNER_COLORS: Record<string, string> = {
  'Colt': '#04D1B7',
  'BT': '#600AA4',
  'Lumen': '#05A8E1',
  'AT&T': '#05A8E1',
  'Telstra': '#154A94',
  'Verizon': '#ED1C23',
  'Zayo Group': '#F9901E',
  'Cisco Webex': '#078855',
  'NVIDIA': '#7DB327',
} as const;

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  FABRIC_PORT: 'Fabric Port',
  NETWORK_EDGE: 'Network Edge',
  INTERNET_ACCESS: 'Internet Access',
  CLOUD_ROUTER: 'Fabric Cloud Router',
  VIRTUAL_CONNECTION: 'Virtual Connection',
  COLOCATION: 'Colocation',
  NSP: 'Network Service Provider',
  CROSS_CONNECT: 'Cross Connect',
} as const;
