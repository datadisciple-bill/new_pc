import Papa from 'papaparse';
import type { PricingSummary } from '@/types/pricing';
import type { CsvExportRow } from '@/types/pricing';
import { formatCurrency } from './priceCalculator';

export function generateCsv(summary: PricingSummary, projectName: string): string {
  const rows: CsvExportRow[] = [];

  for (const metro of summary.metroSubtotals) {
    for (const item of metro.lineItems) {
      rows.push({
        Metro: `${item.metro} - ${item.metroName}`,
        'Service Type': item.serviceType,
        'Service Name': item.serviceName,
        'Configuration Details': item.description,
        Term: item.term,
        Qty: item.quantity,
        'MRC (Monthly)': formatCurrency(item.mrc),
        'NRC (One-Time)': formatCurrency(item.nrc),
        'Annual Cost': formatCurrency(item.annualCost),
      });
    }
  }

  // Add blank row then summary
  const blankRow: Record<string, string | number> = {
    Metro: '', 'Service Type': '', 'Service Name': '',
    'Configuration Details': '', Term: '', Qty: '',
    'MRC (Monthly)': '', 'NRC (One-Time)': '', 'Annual Cost': '',
  };

  const summaryRows: Record<string, string | number>[] = [
    blankRow,
    { ...blankRow, Metro: 'SUMMARY', 'Service Type': projectName },
    { ...blankRow, Metro: 'Total MRC', 'MRC (Monthly)': formatCurrency(summary.totalMrc) },
    { ...blankRow, Metro: 'Total NRC', 'NRC (One-Time)': formatCurrency(summary.totalNrc) },
    { ...blankRow, Metro: 'Total Annual Cost', 'Annual Cost': formatCurrency(summary.totalAnnualCost) },
  ];

  return Papa.unparse([...rows, ...summaryRows]);
}

export function downloadCsv(csvContent: string, projectName: string): void {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Equinix_Pricing_${projectName.replace(/\s+/g, '_')}_${date}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
