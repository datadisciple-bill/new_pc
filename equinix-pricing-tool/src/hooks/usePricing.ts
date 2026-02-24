import { useCallback, useMemo } from 'react';
import { useConfigStore } from '@/store/configStore';
import { searchPrices } from '@/api/fabric';
import { fetchNetworkEdgePricing } from '@/api/networkEdge';
import type { ServiceSelection, FabricPortConfig, NetworkEdgeConfig, CloudRouterConfig, PricingResult } from '@/types/config';
import { calculatePricingSummary, formatCurrency } from '@/utils/priceCalculator';
import { generateCsv, downloadCsv } from '@/utils/csvGenerator';

export function usePricing() {
  const metros = useConfigStore((s) => s.project.metros);
  const connections = useConfigStore((s) => s.project.connections);
  const projectName = useConfigStore((s) => s.project.name);
  const updateServicePricing = useConfigStore((s) => s.updateServicePricing);
  const updateConnectionPricing = useConfigStore((s) => s.updateConnectionPricing);

  const summary = useMemo(
    () => calculatePricingSummary(metros, connections),
    [metros, connections]
  );

  const fetchPriceForService = useCallback(
    async (metroCode: string, service: ServiceSelection) => {
      try {
        let pricing: PricingResult;

        switch (service.type) {
          case 'FABRIC_PORT': {
            const c = service.config as FabricPortConfig;
            const result = await searchPrices('VIRTUAL_PORT_PRODUCT', {
              '/port/bandwidth': c.speed,
              '/port/type': c.type,
              '/port/settings/buyout': false,
            });
            const charge = result.data[0]?.charges ?? [];
            const mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
            const nrc = charge.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
            pricing = { mrc, nrc, currency: 'USD', isEstimate: false, breakdown: [{ description: `${c.speed} ${c.type} Port`, mrc, nrc }] };
            break;
          }
          case 'NETWORK_EDGE': {
            const c = service.config as NetworkEdgeConfig;
            if (!c.deviceTypeCode || !c.packageCode) return;
            const result = await fetchNetworkEdgePricing(c.deviceTypeCode, c.packageCode, c.termLength, metroCode);
            pricing = {
              mrc: result.monthlyRecurring,
              nrc: result.nonRecurring,
              currency: result.currency,
              isEstimate: false,
              breakdown: [{ description: `${c.deviceTypeName} (${c.packageCode})`, mrc: result.monthlyRecurring, nrc: result.nonRecurring }],
            };
            break;
          }
          case 'CLOUD_ROUTER': {
            const c = service.config as CloudRouterConfig;
            const result = await searchPrices('CLOUD_ROUTER_PRODUCT', {
              '/router/package/code': c.package,
              '/router/location/metroCode': metroCode,
            });
            const charge = result.data[0]?.charges ?? [];
            const mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
            const nrc = charge.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
            pricing = { mrc, nrc, currency: 'USD', isEstimate: false, breakdown: [{ description: `FCR ${c.package}`, mrc, nrc }] };
            break;
          }
          case 'INTERNET_ACCESS': {
            // No pricing API — mark as estimate with $0
            pricing = {
              mrc: 0,
              nrc: 0,
              currency: 'USD',
              isEstimate: true,
              breakdown: [{ description: 'Quote Required — Contact Equinix', mrc: 0, nrc: 0 }],
            };
            break;
          }
        }

        updateServicePricing(metroCode, service.id, pricing!);
      } catch (err) {
        console.error('Pricing fetch failed:', err);
      }
    },
    [updateServicePricing]
  );

  const fetchPriceForConnection = useCallback(
    async (connectionId: string, bandwidthMbps: number) => {
      try {
        const result = await searchPrices('VIRTUAL_CONNECTION_PRODUCT', {
          '/connection/bandwidth': bandwidthMbps,
        });
        const charge = result.data[0]?.charges ?? [];
        const mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
        const nrc = charge.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
        const pricing: PricingResult = {
          mrc,
          nrc,
          currency: 'USD',
          isEstimate: false,
          breakdown: [{ description: `${bandwidthMbps}Mbps Connection`, mrc, nrc }],
        };
        updateConnectionPricing(connectionId, pricing);
      } catch (err) {
        console.error('Connection pricing fetch failed:', err);
      }
    },
    [updateConnectionPricing]
  );

  const exportCsv = useCallback(() => {
    const csv = generateCsv(summary, projectName);
    downloadCsv(csv, projectName);
  }, [summary, projectName]);

  return { summary, fetchPriceForService, fetchPriceForConnection, exportCsv, formatCurrency };
}
