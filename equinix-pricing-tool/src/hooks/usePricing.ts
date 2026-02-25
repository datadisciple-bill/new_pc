import { useCallback, useMemo } from 'react';
import { useConfigStore } from '@/store/configStore';
import { searchPrices } from '@/api/fabric';
import { fetchNetworkEdgePricing } from '@/api/networkEdge';
import type { ServiceSelection, FabricPortConfig, NetworkEdgeConfig, CloudRouterConfig, ColocationConfig, PricingResult, BandwidthPriceEntry } from '@/types/config';
import { calculatePricingSummary, formatCurrency } from '@/utils/priceCalculator';
import { generateCsv, downloadCsv } from '@/utils/csvGenerator';
import { BANDWIDTH_OPTIONS } from '@/constants/serviceDefaults';

export function usePricing() {
  const metros = useConfigStore((s) => s.project.metros);
  const connections = useConfigStore((s) => s.project.connections);
  const projectName = useConfigStore((s) => s.project.name);
  const updateServicePricing = useConfigStore((s) => s.updateServicePricing);
  const updateConnectionPricing = useConfigStore((s) => s.updateConnectionPricing);
  const updateConnection = useConfigStore((s) => s.updateConnection);

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
            const bandwidthMbps = parseInt(c.speed) * 1000; // '10G' → 10000
            const result = await searchPrices('VIRTUAL_PORT_PRODUCT', {
              '/port/type': 'XF_PORT',
              '/port/bandwidth': bandwidthMbps,
              '/port/package/code': c.portProduct,
              '/port/connectivitySource/type': 'COLO',
              '/port/settings/buyout': false,
            });
            const charge = result.data[0]?.charges ?? [];
            const mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
            const nrc = charge.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
            const productLabel = c.portProduct === 'UNLIMITED_PLUS' ? 'Unlimited Plus' : c.portProduct === 'UNLIMITED' ? 'Unlimited' : 'Standard';
            const desc = `${c.speed} ${productLabel} ${c.type === 'REDUNDANT' ? 'Redundant' : 'Single'} Port`;
            pricing = { mrc, nrc, currency: 'USD', isEstimate: false, breakdown: [{ description: desc, mrc, nrc }] };
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
          case 'COLOCATION': {
            const c = service.config as ColocationConfig;
            pricing = {
              mrc: c.mrcPrice,
              nrc: 0,
              currency: 'USD',
              isEstimate: true,
              breakdown: [{ description: c.description || 'Colocation', mrc: c.mrcPrice, nrc: 0 }],
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

  const fetchPriceTableForConnection = useCallback(
    async (connectionId: string) => {
      try {
        const entries: BandwidthPriceEntry[] = [];
        for (const bw of BANDWIDTH_OPTIONS) {
          const result = await searchPrices('VIRTUAL_CONNECTION_PRODUCT', {
            '/connection/bandwidth': bw,
          });
          const charge = result.data[0]?.charges ?? [];
          const mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
          const label = bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`;
          entries.push({ bandwidthMbps: bw, label, mrc, currency: 'USD' });
        }
        updateConnection(connectionId, { priceTable: entries });
      } catch (err) {
        console.error('Price table fetch failed:', err);
      }
    },
    [updateConnection]
  );

  const exportCsv = useCallback(() => {
    const csv = generateCsv(summary, projectName, connections);
    downloadCsv(csv, projectName);
  }, [summary, projectName, connections]);

  return { summary, fetchPriceForService, fetchPriceForConnection, fetchPriceTableForConnection, exportCsv, formatCurrency };
}
