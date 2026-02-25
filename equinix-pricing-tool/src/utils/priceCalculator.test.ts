import { describe, it, expect } from 'vitest';
import { calculatePricingSummary, formatCurrency, buildLineItemFromService } from './priceCalculator';
import type { MetroSelection, ServiceSelection, VirtualConnection } from '@/types/config';

describe('formatCurrency', () => {
  it('formats USD amounts', () => {
    expect(formatCurrency(1500)).toBe('$1,500.00');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(99.9)).toBe('$99.90');
  });
});

describe('buildLineItemFromService', () => {
  const metro: MetroSelection = {
    metroCode: 'DC',
    metroName: 'Washington, D.C.',
    region: 'AMER',
    services: [],
  };

  it('builds a Fabric Port line item', () => {
    const service: ServiceSelection = {
      id: 'test-1',
      type: 'FABRIC_PORT',
      config: { speed: '10G', portProduct: 'STANDARD', type: 'REDUNDANT', encapsulation: 'DOT1Q', quantity: 2 },
      pricing: { mrc: 3000, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [] },
    };

    const item = buildLineItemFromService(metro, service);
    expect(item.metro).toBe('DC');
    expect(item.description).toContain('10G');
    expect(item.description).toContain('Redundant');
    expect(item.quantity).toBe(2);
    expect(item.mrc).toBe(3000);
    expect(item.annualCost).toBe(3000 * 12 * 2);
  });

  it('builds an Internet Access line item with quote-required pricing', () => {
    const service: ServiceSelection = {
      id: 'test-2',
      type: 'INTERNET_ACCESS',
      config: { bandwidthMbps: 1000, routingProtocol: 'BGP', connectionType: 'SINGLE', deliveryMethod: 'FABRIC_PORT' },
      pricing: { mrc: 0, nrc: 0, currency: 'USD', isEstimate: true, breakdown: [] },
    };

    const item = buildLineItemFromService(metro, service);
    expect(item.isEstimate).toBe(true);
    expect(item.description).toContain('1 Gbps');
    expect(item.description).toContain('BGP');
  });

  it('builds a Network Edge line item with HA pair quantity = 2', () => {
    const service: ServiceSelection = {
      id: 'test-3',
      type: 'NETWORK_EDGE',
      config: {
        deviceTypeCode: 'CSR1000V',
        deviceTypeName: 'Cisco CSR 1000V',
        vendorName: 'Cisco',
        packageCode: '4',
        softwareVersion: '',
        licenseType: 'SUBSCRIPTION',
        redundant: true,
        termLength: 12,
      },
      pricing: { mrc: 595, nrc: 500, currency: 'USD', isEstimate: false, breakdown: [] },
    };

    const item = buildLineItemFromService(metro, service);
    expect(item.quantity).toBe(2); // HA pair
    expect(item.term).toBe('1yr');
  });

  it('builds a Cloud Router line item', () => {
    const service: ServiceSelection = {
      id: 'test-4',
      type: 'CLOUD_ROUTER',
      config: { package: 'PREMIUM' },
      pricing: { mrc: 900, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [] },
    };

    const item = buildLineItemFromService(metro, service);
    expect(item.description).toContain('PREMIUM');
    expect(item.mrc).toBe(900);
  });
});

describe('calculatePricingSummary', () => {
  it('returns empty summary for no metros', () => {
    const summary = calculatePricingSummary([], []);
    expect(summary.totalMrc).toBe(0);
    expect(summary.totalNrc).toBe(0);
    expect(summary.totalAnnualCost).toBe(0);
    expect(summary.metroSubtotals).toHaveLength(0);
  });

  it('calculates totals across metros', () => {
    const metros: MetroSelection[] = [
      {
        metroCode: 'DC',
        metroName: 'Washington, D.C.',
        region: 'AMER',
        services: [
          {
            id: 's1',
            type: 'FABRIC_PORT',
            config: { speed: '10G', portProduct: 'STANDARD', type: 'PRIMARY', encapsulation: 'DOT1Q', quantity: 1 },
            pricing: { mrc: 1500, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [] },
          },
        ],
      },
      {
        metroCode: 'LD',
        metroName: 'London',
        region: 'EMEA',
        services: [
          {
            id: 's2',
            type: 'CLOUD_ROUTER',
            config: { package: 'STANDARD' },
            pricing: { mrc: 450, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [] },
          },
        ],
      },
    ];

    const connections: VirtualConnection[] = [
      {
        id: 'c1',
        name: 'DC to LD',
        type: 'EVPL_VC',
        aSide: { metroCode: 'DC', type: 'PORT', serviceId: 's1' },
        zSide: { metroCode: 'LD', type: 'CLOUD_ROUTER', serviceId: 's2' },
        bandwidthMbps: 1000,
        redundant: false,
        pricing: { mrc: 1500, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [] },
        showPriceTable: false,
        priceTable: null,
      },
    ];

    const summary = calculatePricingSummary(metros, connections);
    expect(summary.metroSubtotals).toHaveLength(2);

    // DC: port (1500*1) + connection (1500*1) = 3000
    expect(summary.metroSubtotals[0].mrc).toBe(3000);
    // LD: cloud router (450*1) = 450
    expect(summary.metroSubtotals[1].mrc).toBe(450);

    expect(summary.totalMrc).toBe(3450);
    expect(summary.totalAnnualCost).toBe(3450 * 12);
  });
});
