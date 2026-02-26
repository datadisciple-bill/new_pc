import { useCallback, useMemo } from 'react';
import { useConfigStore } from '@/store/configStore';
import { searchPrices } from '@/api/fabric';
import { fetchNetworkEdgePricing } from '@/api/networkEdge';
import type { ServiceSelection, FabricPortConfig, NetworkEdgeConfig, CloudRouterConfig, ColocationConfig, PricingResult, BandwidthPriceEntry } from '@/types/config';
import { calculatePricingSummary, formatCurrency } from '@/utils/priceCalculator';
import { generateCsv, downloadCsv } from '@/utils/csvGenerator';
import { BANDWIDTH_OPTIONS } from '@/constants/serviceDefaults';
import { lookupIbxForMetro } from '@/data/defaultPricing';
import { getCachedVCPrice, setCachedVCPrice } from '@/api/vcPricingCache';

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
            const ibx = lookupIbxForMetro(metroCode);
            const result = await searchPrices('VIRTUAL_PORT_PRODUCT', {
              '/port/location/ibx': ibx,
              '/port/type': 'XF_PORT',
              '/port/bandwidth': bandwidthMbps,
              '/port/package/code': c.portProduct,
              '/port/connectivitySource/type': 'COLO',
              '/port/settings/buyout': false,
              '/port/lag/enabled': false,
            });
            const charge = result.data[0]?.charges ?? [];
            const mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
            const nrc = charge.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
            const productLabel = c.portProduct === 'UNLIMITED_PLUS' ? 'Unlimited Plus' : c.portProduct === 'UNLIMITED' ? 'Unlimited' : 'Standard';
            const typeLabel = c.type === 'REDUNDANT' ? 'Redundant' : c.type === 'SECONDARY' ? 'Secondary' : 'Primary';
            const desc = `${c.speed} ${productLabel} ${typeLabel} Port`;
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
          case 'NSP': {
            // Network Service Providers have no charge
            pricing = {
              mrc: 0,
              nrc: 0,
              currency: 'USD',
              isEstimate: false,
              breakdown: [],
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
    async (connectionId: string, bandwidthMbps: number, aSideMetro?: string, zSideMetro?: string) => {
      try {
        // Always read latest state to avoid stale closure after addConnection
        const conn = useConfigStore.getState().project.connections.find((c) => c.id === connectionId);

        // Local site connections have no Equinix pricing
        if (conn && (conn.aSide.type === 'LOCAL_SITE' || conn.zSide.type === 'LOCAL_SITE')) {
          updateConnectionPricing(connectionId, {
            mrc: 0, nrc: 0, currency: 'USD', isEstimate: false,
            breakdown: [{ description: 'Local site connection', mrc: 0, nrc: 0 }],
          });
          return;
        }

        const aMetro = aSideMetro ?? conn?.aSide.metroCode ?? 'DC';
        const zMetro = zSideMetro ?? conn?.zSide.metroCode ?? aMetro;
        const isCloudConnection = conn?.zSide.type === 'SERVICE_PROFILE';

        // Same-metro connections between same endpoint types are $0;
        // mixed-type (e.g. Port ↔ NE) and cloud connections still have a cost.
        if (aMetro === zMetro && !isCloudConnection) {
          const isMixedType = conn && conn.aSide.type !== conn.zSide.type;
          if (!isMixedType) {
            const pricing: PricingResult = {
              mrc: 0,
              nrc: 0,
              currency: 'USD',
              isEstimate: false,
              breakdown: [{ description: `Local ${bandwidthMbps}Mbps Connection`, mrc: 0, nrc: 0 }],
            };
            updateConnectionPricing(connectionId, pricing);
            return;
          }
        }

        // Cloud provider connections: z-side is a Service Profile (SP), not COLO
        const zSideType = isCloudConnection ? 'SP' : 'COLO';
        const cacheKey = isCloudConnection ? `${aMetro}-SP` : zMetro;

        // Check 24h cache first
        const cached = getCachedVCPrice(aMetro, cacheKey, bandwidthMbps);
        let mrc: number;
        let nrc: number;

        if (cached) {
          mrc = cached.mrc;
          nrc = cached.nrc;
        } else {
          const result = await searchPrices('VIRTUAL_CONNECTION_PRODUCT', {
            '/connection/type': 'EVPL_VC',
            '/connection/bandwidth': bandwidthMbps,
            '/connection/aSide/accessPoint/type': 'COLO',
            '/connection/aSide/accessPoint/location/metroCode': aMetro,
            '/connection/aSide/accessPoint/port/settings/buyout': false,
            '/connection/zSide/accessPoint/type': zSideType,
            '/connection/zSide/accessPoint/location/metroCode': zMetro,
          });
          const charge = result.data[0]?.charges ?? [];
          mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
          nrc = charge.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
          setCachedVCPrice(aMetro, cacheKey, bandwidthMbps, mrc, nrc);
        }

        const cloudLabel = isCloudConnection ? conn?.zSide.serviceProfileName ?? 'Cloud' : `${zMetro}`;
        const pricing: PricingResult = {
          mrc,
          nrc,
          currency: 'USD',
          isEstimate: false,
          breakdown: [{ description: `${bandwidthMbps}Mbps ${aMetro}-${cloudLabel} Connection`, mrc, nrc }],
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
        // Always read latest state to avoid stale closure after addConnection
        const conn = useConfigStore.getState().project.connections.find((c) => c.id === connectionId);
        const aMetro = conn?.aSide.metroCode ?? 'DC';
        const zMetro = conn?.zSide.metroCode ?? aMetro;
        const isCloudConnection = conn?.zSide.type === 'SERVICE_PROFILE';

        // Same-metro same-type connections are $0 at all bandwidths (not cloud)
        if (aMetro === zMetro && !isCloudConnection) {
          const isMixedType = conn && conn.aSide.type !== conn.zSide.type;
          if (!isMixedType) {
            const entries: BandwidthPriceEntry[] = BANDWIDTH_OPTIONS.map((bw) => ({
              bandwidthMbps: bw,
              label: bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`,
              mrc: 0,
              currency: 'USD',
            }));
            updateConnection(connectionId, { priceTable: entries });
            return;
          }
        }

        const zSideType = isCloudConnection ? 'SP' : 'COLO';
        const cacheKey = isCloudConnection ? `${aMetro}-SP` : zMetro;

        const entries: BandwidthPriceEntry[] = [];
        for (const bw of BANDWIDTH_OPTIONS) {
          const cached = getCachedVCPrice(aMetro, cacheKey, bw);
          let mrc: number;
          if (cached) {
            mrc = cached.mrc;
          } else {
            const result = await searchPrices('VIRTUAL_CONNECTION_PRODUCT', {
              '/connection/type': 'EVPL_VC',
              '/connection/bandwidth': bw,
              '/connection/aSide/accessPoint/type': 'COLO',
              '/connection/aSide/accessPoint/location/metroCode': aMetro,
              '/connection/aSide/accessPoint/port/settings/buyout': false,
              '/connection/zSide/accessPoint/type': zSideType,
              '/connection/zSide/accessPoint/location/metroCode': zMetro,
            });
            const charge = result.data[0]?.charges ?? [];
            mrc = charge.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
            const nrc = charge.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
            setCachedVCPrice(aMetro, cacheKey, bw, mrc, nrc);
          }
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
