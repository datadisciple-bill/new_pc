import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { SERVICE_TYPE_LABELS } from '@/constants/brandColors';
import type { PricingResult } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';
import fabricPortIcon from '@/assets/icons/fabric-port.svg';
import networkEdgeIcon from '@/assets/icons/network-edge.svg';
import internetAccessIcon from '@/assets/icons/internet-access.svg';
import cloudRouterIcon from '@/assets/icons/cloud-router.svg';
import colocationIcon from '@/assets/icons/colocation.svg';
import nspIcon from '@/assets/icons/nsp.svg';
import crossConnectIcon from '@/assets/icons/cross-connect.svg';

interface ServiceNodeData {
  serviceId: string;
  serviceType: string;
  config: Record<string, unknown>;
  pricing: PricingResult | null;
  showPricing: boolean;
  isExisting?: boolean;
  hasAnyExisting?: boolean;
  [key: string]: unknown;
}

const SERVICE_ICON_URLS: Record<string, string> = {
  FABRIC_PORT: fabricPortIcon,
  NETWORK_EDGE: networkEdgeIcon,
  INTERNET_ACCESS: internetAccessIcon,
  CLOUD_ROUTER: cloudRouterIcon,
  COLOCATION: colocationIcon,
  NSP: nspIcon,
  CROSS_CONNECT: crossConnectIcon,
};

export const ServiceNode = memo(function ServiceNode({ data }: NodeProps) {
  const { serviceType, config, pricing, showPricing, isExisting, hasAnyExisting } = data as ServiceNodeData;
  const label = SERVICE_TYPE_LABELS[serviceType as string] ?? serviceType;
  const iconUrl = SERVICE_ICON_URLS[serviceType as string];

  let detail = '';
  let detailExtra: React.ReactNode = null;
  let isHaPair = false;

  let portRedundancy: string | null = null;

  let quantity = 1;

  if (serviceType === 'FABRIC_PORT') {
    const c = config as { speed?: string; type?: string; quantity?: number };
    portRedundancy = c.type ?? 'PRIMARY';
    detail = c.speed ?? '';
    quantity = c.quantity ?? 1;
    isHaPair = c.type === 'REDUNDANT';
  } else if (serviceType === 'NETWORK_EDGE') {
    const c = config as { deviceTypeName?: string; redundant?: boolean; packageCode?: string; coreMemory?: string; softwareName?: string };
    detail = c.deviceTypeName ?? '';
    isHaPair = c.redundant === true;
    const cores = c.packageCode ? `${c.packageCode} vCPU` : '';
    const mem = c.coreMemory ?? '';
    const sw = c.softwareName ?? '';
    if (cores || mem || sw) {
      detailExtra = (
        <p className="text-[9px] leading-tight">
          {cores && <span className="font-semibold" style={{ color: '#0067B8' }}>{cores}</span>}
          {cores && mem && <span className="text-gray-400"> / </span>}
          {mem && <span className="font-semibold" style={{ color: '#7B2D8E' }}>{mem}</span>}
          {sw && (cores || mem) && <span className="text-gray-400"> &middot; </span>}
          {sw && <span className="text-gray-500">{sw}</span>}
        </p>
      );
    }
  } else if (serviceType === 'INTERNET_ACCESS') {
    const c = config as { bandwidthMbps?: number; routingProtocol?: string };
    const bw = c.bandwidthMbps ?? 0;
    const bwLabel = bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`;
    const routingMap: Record<string, string> = { STATIC: 'Static', DIRECT: 'Direct', BGP: 'BGP' };
    const routing = routingMap[c.routingProtocol ?? ''] ?? '';
    detail = routing ? `${bwLabel} | ${routing}` : bwLabel;
  } else if (serviceType === 'CLOUD_ROUTER') {
    const c = config as { package?: string };
    detail = c.package ?? '';
  } else if (serviceType === 'COLOCATION') {
    const c = config as { description?: string };
    detail = c.description ?? '';
  } else if (serviceType === 'NSP') {
    const c = config as { providerName?: string };
    detail = c.providerName ?? '';
  } else if (serviceType === 'CROSS_CONNECT') {
    const c = config as { connectionService?: string; connectorType?: string; quantity?: number };
    const mediaShort = c.connectionService === 'SINGLE_MODE_FIBER' ? 'SMF' : c.connectionService === 'MULTI_MODE_FIBER' ? 'MMF' : c.connectionService ?? '';
    detail = `${mediaShort} ${c.connectorType ?? ''}`;
    quantity = c.quantity ?? 1;
  }

  return (
    <>
      {isExisting && (
        <div className="absolute -top-4 left-0 text-[8px] font-bold tracking-wide" style={{ color: '#33A85C' }}>
          &#9679; EXISTING
        </div>
      )}
      {!isExisting && hasAnyExisting && (
        <div className="absolute -top-4 left-0 text-[8px] font-bold tracking-wide" style={{ color: '#E91C24' }}>
          &#9679; NEW
        </div>
      )}
    <div
      className={`rounded-md overflow-hidden shadow-sm bg-white ${isExisting ? 'border-2 border-dashed' : 'border border-gray-200'}`}
      style={{ width: '100%', height: '100%', ...(isExisting ? { borderColor: '#33A85C' } : {}) }}
    >
      {/* Black Equinix product bar */}
      <div className="bg-equinix-black text-white px-2 py-1 flex items-center gap-1.5">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={label}
            className="w-4 h-4 flex-shrink-0"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        ) : (
          <span className="text-[10px] font-bold bg-white text-black rounded px-1">?</span>
        )}
        <span className="text-[10px] font-bold truncate">{label}</span>
        {isHaPair && (
          <span className="ml-auto text-[8px] font-bold bg-equinix-red text-white rounded px-1 py-px flex-shrink-0">
            HA
          </span>
        )}
      </div>
      <div className="bg-white px-2 py-1">
        <p className="text-[9px] text-gray-600 truncate">
          {detail}
          {portRedundancy === 'PRIMARY' && (
            <span className="ml-1 font-bold" style={{ color: '#0067B8' }}>Primary</span>
          )}
          {portRedundancy === 'SECONDARY' && (
            <span className="ml-1 font-bold" style={{ color: '#E91C24' }}>Secondary</span>
          )}
          {portRedundancy === 'REDUNDANT' && (
            <>
              <span className="ml-1 font-bold" style={{ color: '#0067B8' }}>Primary</span>
              <span className="mx-0.5 text-gray-400">/</span>
              <span className="font-bold" style={{ color: '#E91C24' }}>Secondary</span>
            </>
          )}
        </p>
        {detailExtra}
        {isHaPair && serviceType === 'NETWORK_EDGE' && (
          <p className="text-[9px] text-equinix-red font-medium">HA Pair (2x devices)</p>
        )}
        {showPricing !== false && pricing && pricing.mrc > 0 && (
          <p className="text-[9px] text-equinix-green font-medium">
            {isHaPair
              ? `${formatCurrency(pricing.mrc)} x2 = ${formatCurrency(pricing.mrc * 2)}/mo`
              : quantity > 1
                ? `${formatCurrency(pricing.mrc)} x${quantity} = ${formatCurrency(pricing.mrc * quantity)}/mo`
                : `${formatCurrency(pricing.mrc)}/mo`}
          </p>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
      <Handle type="target" position={Position.Right} id="right-target" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-equinix-black !w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" />
    </div>
    </>
  );
});
