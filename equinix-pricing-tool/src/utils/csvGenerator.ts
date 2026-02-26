import Papa from 'papaparse';
import type { PricingSummary } from '@/types/pricing';
import type { CsvExportRow } from '@/types/pricing';
import type { VirtualConnection } from '@/types/config';
import { formatCurrency } from './priceCalculator';

export function generateCsv(
  summary: PricingSummary,
  projectName: string,
  connections?: VirtualConnection[]
): string {
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

  // Price tables for connections with showPriceTable enabled
  const priceTableRows: Record<string, string | number>[] = [];
  if (connections) {
    for (const conn of connections) {
      if (conn.showPriceTable && conn.priceTable && conn.priceTable.length > 0) {
        priceTableRows.push(blankRow);
        priceTableRows.push({
          ...blankRow,
          Metro: 'BANDWIDTH PRICE TABLE',
          'Service Type': conn.name || conn.type,
          'Service Name': `${conn.aSide.metroCode} -> ${conn.zSide.serviceProfileName ?? conn.zSide.metroCode}`,
        });
        // Header
        priceTableRows.push({
          ...blankRow,
          Metro: 'Bandwidth',
          'MRC (Monthly)': 'MRC',
          'Annual Cost': 'Annual Cost',
        });
        for (const entry of conn.priceTable) {
          const isSelected = entry.bandwidthMbps === conn.bandwidthMbps;
          priceTableRows.push({
            ...blankRow,
            Metro: `${isSelected ? '> ' : ''}${entry.label}`,
            'MRC (Monthly)': formatCurrency(entry.mrc),
            'Annual Cost': formatCurrency(entry.mrc * 12),
          });
        }
      }
    }
  }

  // Replace Unicode symbols that break in some CSV readers (e.g. Excel Latin-1 mode)
  const raw = Papa.unparse([...rows, ...summaryRows, ...priceTableRows]);
  return raw.replace(/→/g, '->').replace(/←/g, '<-').replace(/►/g, '>').replace(/◄/g, '<');
}

export function downloadCsv(csvContent: string, projectName: string): void {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Equinix_Pricing_${projectName.replace(/\s+/g, '_')}_${date}.csv`;
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
