import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { SERVICE_TYPE_LABELS } from '@/constants/brandColors';
import type { PricingResult } from '@/types/config';
import { formatCurrency } from '@/utils/priceCalculator';

interface ServiceNodeData {
  serviceId: string;
  serviceType: string;
  config: Record<string, unknown>;
  pricing: PricingResult | null;
  [key: string]: unknown;
}

const SERVICE_ICONS: Record<string, string> = {
  FABRIC_PORT: 'FP',
  NETWORK_EDGE: 'NE',
  INTERNET_ACCESS: 'IA',
  CLOUD_ROUTER: 'FCR',
};

export const ServiceNode = memo(function ServiceNode({ data }: NodeProps) {
  const { serviceType, config, pricing } = data as ServiceNodeData;
  const label = SERVICE_TYPE_LABELS[serviceType as string] ?? serviceType;
  const icon = SERVICE_ICONS[serviceType as string] ?? '?';

  let detail = '';
  let isHaPair = false;

  if (serviceType === 'FABRIC_PORT') {
    const c = config as { speed?: string; type?: string };
    detail = `${c.speed ?? ''} ${c.type === 'REDUNDANT' ? 'Redundant' : 'Single'}`;
  } else if (serviceType === 'NETWORK_EDGE') {
    const c = config as { deviceTypeName?: string; redundant?: boolean };
    detail = c.deviceTypeName ?? '';
    isHaPair = c.redundant === true;
  } else if (serviceType === 'INTERNET_ACCESS') {
    const c = config as { bandwidthMbps?: number };
    const bw = c.bandwidthMbps ?? 0;
    detail = bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`;
  } else if (serviceType === 'CLOUD_ROUTER') {
    const c = config as { package?: string };
    detail = c.package ?? '';
  }

  return (
    <div className="rounded-md overflow-hidden shadow-sm border border-gray-200" style={{ width: '100%', height: '100%' }}>
      {/* Black Equinix product bar */}
      <div className="bg-equinix-black text-white px-2 py-1 flex items-center gap-1.5">
        <span className="text-[10px] font-bold bg-white text-black rounded px-1">{icon}</span>
        <span className="text-[10px] font-bold truncate">{label}</span>
        {isHaPair && (
          <span className="ml-auto text-[8px] font-bold bg-equinix-red text-white rounded px-1 py-px flex-shrink-0">
            HA
          </span>
        )}
      </div>
      <div className="bg-white px-2 py-1">
        <p className="text-[9px] text-gray-600 truncate">{detail}</p>
        {isHaPair && (
          <p className="text-[9px] text-equinix-red font-medium">HA Pair (2x devices)</p>
        )}
        {pricing && (
          <p className="text-[9px] text-equinix-green font-medium">
            {formatCurrency(pricing.mrc)}/mo
          </p>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-equinix-black !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-equinix-black !w-2 !h-2" />
    </div>
  );
});
