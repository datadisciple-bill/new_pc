import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

interface MetroNodeData {
  metroCode: string;
  metroName: string;
  region: string;
  [key: string]: unknown;
}

const REGION_COLORS: Record<string, string> = {
  AMER: '#3B82F6',
  EMEA: '#10B981',
  APAC: '#8B5CF6',
};

export const MetroNode = memo(function MetroNode({ data }: NodeProps) {
  const { metroCode, metroName, region } = data as MetroNodeData;
  const regionColor = REGION_COLORS[region as string] ?? '#6B7280';

  return (
    <div
      className="rounded-lg border-2 border-gray-300 bg-equinix-gray overflow-hidden"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ backgroundColor: regionColor }}
      >
        <span className="text-white text-xs font-bold">{metroCode}</span>
        <span className="text-white text-xs">{metroName}</span>
      </div>
    </div>
  );
});
