// Pricing display and export types

export interface PriceLineItem {
  metro: string;
  metroName: string;
  serviceType: string;
  serviceName: string;
  description: string;
  term: string;
  quantity: number;
  mrc: number;
  nrc: number;
  annualCost: number;
  isEstimate: boolean;
}

export interface MetroSubtotal {
  metroCode: string;
  metroName: string;
  mrc: number;
  nrc: number;
  annualCost: number;
  lineItems: PriceLineItem[];
}

export interface PricingSummary {
  metroSubtotals: MetroSubtotal[];
  totalMrc: number;
  totalNrc: number;
  totalAnnualCost: number;
}

export interface CsvExportRow {
  Metro: string;
  'Service Type': string;
  'Service Name': string;
  'Configuration Details': string;
  Term: string;
  Qty: number;
  'MRC (Monthly)': string;
  'NRC (One-Time)': string;
  'Annual Cost': string;
}
