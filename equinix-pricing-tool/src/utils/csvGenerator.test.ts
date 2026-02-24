import { describe, it, expect } from 'vitest';
import { generateCsv } from './csvGenerator';
import type { PricingSummary } from '@/types/pricing';

describe('generateCsv', () => {
  it('generates CSV with line items and summary', () => {
    const summary: PricingSummary = {
      metroSubtotals: [
        {
          metroCode: 'DC',
          metroName: 'Washington, D.C.',
          mrc: 1500,
          nrc: 0,
          annualCost: 18000,
          lineItems: [
            {
              metro: 'DC',
              metroName: 'Washington, D.C.',
              serviceType: 'Fabric Port',
              serviceName: 'Fabric Port',
              description: '10G Single Port, DOT1Q',
              term: 'Monthly',
              quantity: 1,
              mrc: 1500,
              nrc: 0,
              annualCost: 18000,
              isEstimate: false,
            },
          ],
        },
      ],
      totalMrc: 1500,
      totalNrc: 0,
      totalAnnualCost: 18000,
    };

    const csv = generateCsv(summary, 'Test Project');

    // Should contain header
    expect(csv).toContain('Metro');
    expect(csv).toContain('MRC (Monthly)');
    expect(csv).toContain('Annual Cost');

    // Should contain line item
    expect(csv).toContain('DC - Washington');
    expect(csv).toContain('Fabric Port');
    expect(csv).toContain('10G Single Port');

    // Should contain summary
    expect(csv).toContain('SUMMARY');
    expect(csv).toContain('Total MRC');
    expect(csv).toContain('Total Annual Cost');
  });

  it('generates empty CSV for no data', () => {
    const summary: PricingSummary = {
      metroSubtotals: [],
      totalMrc: 0,
      totalNrc: 0,
      totalAnnualCost: 0,
    };

    const csv = generateCsv(summary, 'Empty');
    expect(csv).toContain('SUMMARY');
    expect(csv).toContain('$0.00');
  });
});
