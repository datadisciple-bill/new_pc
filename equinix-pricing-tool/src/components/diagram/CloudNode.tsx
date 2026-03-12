import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CLOUD_PROVIDER_COLORS } from '@/constants/brandColors';

interface CloudNodeData {
  provider: string;
  cloudRegion?: string;
  cloudMetro?: string;
  [key: string]: unknown;
}

export const CloudNode = memo(function CloudNode({ data }: NodeProps) {
  const { provider, cloudRegion, cloudMetro } = data as CloudNodeData;

  // Find matching color by checking if provider name contains any key
  let bgColor = '#6B7280';
  for (const [name, color] of Object.entries(CLOUD_PROVIDER_COLORS)) {
    if (provider.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
      bgColor = color;
      break;
    }
  }

  return (
    <div className="rounded-md overflow-hidden shadow-sm" style={{ width: 180, minHeight: 56 }}>
      <div
        className="text-white px-3 py-1.5 flex flex-col justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <span className="text-xs font-bold">{provider}</span>
        {cloudRegion && (
          <span className="text-[9px] opacity-90 truncate">
            {cloudRegion}{cloudMetro ? ` — ${cloudMetro}` : ''}
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
      <Handle type="target" position={Position.Right} id="right-target" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-white !border-2" style={{ borderColor: bgColor }} />
    </div>
  );
});
