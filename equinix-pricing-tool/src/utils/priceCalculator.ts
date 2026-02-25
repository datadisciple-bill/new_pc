import type { ServiceSelection, VirtualConnection, MetroSelection } from '@/types/config';
import type { PriceLineItem, MetroSubtotal, PricingSummary } from '@/types/pricing';
import { SERVICE_TYPE_LABELS } from '@/constants/brandColors';

function formatServiceDescription(service: ServiceSelection): string {
  switch (service.type) {
    case 'FABRIC_PORT': {
      const c = service.config as { speed: string; type: string; encapsulation: string; quantity: number };
      return `${c.speed} ${c.type === 'REDUNDANT' ? 'Redundant' : 'Single'} Port, ${c.encapsulation}`;
    }
    case 'NETWORK_EDGE': {
      const c = service.config as { deviceTypeName: string; packageCode: string; licenseType: string; redundant: boolean };
      return `${c.deviceTypeName || 'Device'}${c.redundant ? ' (HA Pair)' : ''}, ${c.licenseType}`;
    }
    case 'INTERNET_ACCESS': {
      const c = service.config as { bandwidthMbps: number; routingProtocol: string; connectionType: string };
      const bw = c.bandwidthMbps >= 1000 ? `${c.bandwidthMbps / 1000} Gbps` : `${c.bandwidthMbps} Mbps`;
      return `${bw} ${c.routingProtocol}, ${c.connectionType === 'DUAL' ? 'Dual' : 'Single'}`;
    }
    case 'CLOUD_ROUTER': {
      const c = service.config as { package: string };
      return `${c.package} Package`;
    }
    case 'COLOCATION': {
      const c = service.config as { description: string };
      return c.description || 'Colocation';
    }
  }
}

function getTermLabel(service: ServiceSelection): string {
  if (service.type === 'NETWORK_EDGE') {
    const c = service.config as { termLength: number };
    if (c.termLength === 1) return 'Monthly';
    return `${c.termLength / 12}yr`;
  }
  return 'Monthly';
}

function getQuantity(service: ServiceSelection): number {
  if (service.type === 'FABRIC_PORT') {
    return (service.config as { quantity: number }).quantity;
  }
  if (service.type === 'NETWORK_EDGE' && (service.config as { redundant: boolean }).redundant) {
    return 2;
  }
  if (service.type === 'INTERNET_ACCESS' && (service.config as { connectionType: string }).connectionType === 'DUAL') {
    return 2;
  }
  return 1;
}

export function buildLineItemFromService(
  metro: MetroSelection,
  service: ServiceSelection
): PriceLineItem {
  const pricing = service.pricing;
  const qty = getQuantity(service);
  const mrc = pricing?.mrc ?? 0;
  const nrc = pricing?.nrc ?? 0;

  return {
    metro: metro.metroCode,
    metroName: metro.metroName,
    serviceType: SERVICE_TYPE_LABELS[service.type] ?? service.type,
    serviceName: SERVICE_TYPE_LABELS[service.type] ?? service.type,
    description: formatServiceDescription(service),
    term: getTermLabel(service),
    quantity: qty,
    mrc,
    nrc,
    annualCost: mrc * 12 * qty,
    isEstimate: pricing?.isEstimate ?? true,
  };
}

export function buildLineItemFromConnection(
  connection: VirtualConnection,
  metros: MetroSelection[]
): PriceLineItem {
  const pricing = connection.pricing;
  const bw = connection.bandwidthMbps >= 1000
    ? `${connection.bandwidthMbps / 1000} Gbps`
    : `${connection.bandwidthMbps} Mbps`;
  const aSideMetro = metros.find((m) => m.metroCode === connection.aSide.metroCode);
  const zSideName = connection.zSide.serviceProfileName ?? connection.zSide.metroCode;
  const qty = connection.redundant ? 2 : 1;
  const mrc = pricing?.mrc ?? 0;

  return {
    metro: connection.aSide.metroCode,
    metroName: aSideMetro?.metroName ?? connection.aSide.metroCode,
    serviceType: 'Virtual Connection',
    serviceName: `${connection.type} Connection`,
    description: `${bw} to ${zSideName}${connection.redundant ? ' (Redundant)' : ''}`,
    term: 'Monthly',
    quantity: qty,
    mrc,
    nrc: pricing?.nrc ?? 0,
    annualCost: mrc * 12 * qty,
    isEstimate: pricing?.isEstimate ?? true,
  };
}

export function calculatePricingSummary(
  metros: MetroSelection[],
  connections: VirtualConnection[]
): PricingSummary {
  const metroSubtotals: MetroSubtotal[] = [];

  for (const metro of metros) {
    const serviceItems = metro.services.map((s) => buildLineItemFromService(metro, s));
    const connItems = connections
      .filter((c) => c.aSide.metroCode === metro.metroCode)
      .map((c) => buildLineItemFromConnection(c, metros));

    const allItems = [...serviceItems, ...connItems];
    const mrc = allItems.reduce((sum, item) => sum + item.mrc * item.quantity, 0);
    const nrc = allItems.reduce((sum, item) => sum + item.nrc * item.quantity, 0);

    metroSubtotals.push({
      metroCode: metro.metroCode,
      metroName: metro.metroName,
      mrc,
      nrc,
      annualCost: mrc * 12,
      lineItems: allItems,
    });
  }

  const totalMrc = metroSubtotals.reduce((sum, m) => sum + m.mrc, 0);
  const totalNrc = metroSubtotals.reduce((sum, m) => sum + m.nrc, 0);

  return {
    metroSubtotals,
    totalMrc,
    totalNrc,
    totalAnnualCost: totalMrc * 12,
  };
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
