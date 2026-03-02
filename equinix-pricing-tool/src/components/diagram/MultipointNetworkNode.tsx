import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton';

interface MultipointNetworkNodeData {
  networkId: string;
  name: string;
  networkType: string;
  scope: string;
  region?: string;
  typeLabel: string;
  color: string;
  [key: string]: unknown;
}

export const MultipointNetworkNode = memo(function MultipointNetworkNode({ data, selected }: NodeProps) {
  const { networkId, name, typeLabel, scope, region, color } = data as MultipointNetworkNodeData;
  const updateNetwork = useConfigStore((s) => s.updateNetwork);
  const removeNetwork = useConfigStore((s) => s.removeNetwork);

  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalName(name); }, [name]);
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const handleNameBlur = useCallback(() => {
    setEditingName(false);
    updateNetwork(networkId, { name: localName });
  }, [networkId, localName, updateNetwork]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingName(false);
      updateNetwork(networkId, { name: localName });
    }
  }, [networkId, localName, updateNetwork]);

  const REGION_NAMES: Record<string, string> = { AMER: 'Americas', EMEA: 'EMEA', APAC: 'Asia Pacific' };
  const scopeLabel = scope === 'REGIONAL' && region
    ? REGION_NAMES[region] ?? region
    : scope === 'LOCAL' ? 'Local' : scope === 'GLOBAL' ? 'Global' : 'Regional';

  return (
    <div
      className="relative group"
      style={{ width: '100%', height: '100%' }}
    >
      <div
        className={`w-full h-full rounded-md overflow-hidden shadow-sm border ${
          selected ? 'border-blue-400 shadow-md' : 'border-gray-200'
        } bg-white`}
      >
        {/* Colored header bar */}
        <div
          className="text-white px-2 py-1 flex items-center gap-1.5"
          style={{ backgroundColor: color }}
        >
          {/* Network icon */}
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {editingName ? (
            <input
              ref={nameInputRef}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="flex-1 min-w-0 text-[10px] font-bold text-white bg-transparent border-b border-white/50 outline-none px-0"
            />
          ) : (
            <span
              className="text-[10px] font-bold truncate cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true); }}
            >
              {name}
            </span>
          )}
        </div>
        {/* White detail area */}
        <div className="bg-white px-2 py-1.5">
          <p className="text-[9px] text-gray-600 truncate">{typeLabel}</p>
          <p className="text-[8px] text-gray-400">{scopeLabel}</p>
        </div>
      </div>

      {/* Delete button */}
      <ConfirmDeleteButton
        onDelete={() => removeNetwork(networkId)}
        requiresConfirm={name !== 'Multipoint Network'}
        className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove network"
        confirmClassName="absolute -top-1 -right-1 z-50 bg-white border border-gray-200 rounded-md shadow-md px-1.5 py-1"
      >
        x
      </ConfirmDeleteButton>
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" style={{ backgroundColor: color }} />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" style={{ backgroundColor: color }} />
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" style={{ backgroundColor: color }} />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 hover:!w-3 hover:!h-3 hover:!ring-2 hover:!ring-equinix-green transition-all cursor-crosshair" style={{ backgroundColor: color }} />
    </div>
  );
});
