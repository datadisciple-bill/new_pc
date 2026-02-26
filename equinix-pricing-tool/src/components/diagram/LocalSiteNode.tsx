import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';
import type { LocalSiteIcon } from '@/types/config';
import fabricPortIcon from '@/assets/icons/fabric-port.svg';
import networkEdgeIcon from '@/assets/icons/network-edge.svg';
import internetAccessIcon from '@/assets/icons/internet-access.svg';
import cloudRouterIcon from '@/assets/icons/cloud-router.svg';
import colocationIcon from '@/assets/icons/colocation.svg';

interface LocalSiteNodeData {
  localSiteId: string;
  name: string;
  icon: LocalSiteIcon;
  [key: string]: unknown;
}

const ICON_OPTIONS: { key: LocalSiteIcon; label: string; src: string }[] = [
  { key: 'colocation', label: 'Data Center', src: colocationIcon },
  { key: 'network-edge', label: 'Network Device', src: networkEdgeIcon },
  { key: 'fabric-port', label: 'Port', src: fabricPortIcon },
  { key: 'internet-access', label: 'Internet / Globe', src: internetAccessIcon },
  { key: 'cloud-router', label: 'Router', src: cloudRouterIcon },
];

function getIconSrc(icon: LocalSiteIcon): string {
  return ICON_OPTIONS.find((o) => o.key === icon)?.src ?? colocationIcon;
}

export const LocalSiteNode = memo(function LocalSiteNode({ data, selected }: NodeProps) {
  const { localSiteId, name, icon } = data as LocalSiteNodeData;
  const updateLocalSite = useConfigStore((s) => s.updateLocalSite);
  const removeLocalSite = useConfigStore((s) => s.removeLocalSite);

  const [editing, setEditing] = useState(false);
  const [localName, setLocalName] = useState(name);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalName(name); }, [name]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Close icon picker on outside click
  useEffect(() => {
    if (!showIconPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showIconPicker]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    updateLocalSite(localSiteId, { name: localName });
  }, [localSiteId, localName, updateLocalSite]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditing(false);
      updateLocalSite(localSiteId, { name: localName });
    }
  }, [localSiteId, localName, updateLocalSite]);

  const handleIconSelect = useCallback((iconKey: LocalSiteIcon) => {
    updateLocalSite(localSiteId, { icon: iconKey });
    setShowIconPicker(false);
  }, [localSiteId, updateLocalSite]);

  const currentIcon = icon ?? 'colocation';

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
        {/* Black header bar — matches ServiceNode */}
        <div className="bg-equinix-black text-white px-2 py-1 flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setShowIconPicker(!showIconPicker); }}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
            title="Change icon"
          >
            <img
              src={getIconSrc(currentIcon)}
              alt="icon"
              className="w-4 h-4"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </button>
          {editing ? (
            <input
              ref={inputRef}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 text-[10px] font-bold text-white bg-transparent border-b border-gray-400 outline-none px-0"
            />
          ) : (
            <span
              className="text-[10px] font-bold truncate cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            >
              {name}
            </span>
          )}
        </div>
        {/* White body area */}
        <div className="bg-white px-2 py-1">
          <p className="text-[9px] text-gray-400 truncate">
            {ICON_OPTIONS.find((o) => o.key === currentIcon)?.label ?? 'Local Site'}
          </p>
        </div>
      </div>

      {/* Icon picker dropdown */}
      {showIconPicker && (
        <div
          ref={pickerRef}
          className="absolute top-8 left-0 z-50 bg-white rounded-md shadow-lg border border-gray-200 p-1.5 flex flex-col gap-0.5"
          style={{ minWidth: 140 }}
        >
          {ICON_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={(e) => { e.stopPropagation(); handleIconSelect(opt.key); }}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left text-[10px] transition-colors ${
                currentIcon === opt.key
                  ? 'bg-gray-900 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <img
                src={opt.src}
                alt={opt.label}
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ filter: currentIcon === opt.key ? 'brightness(0) invert(1)' : 'none' }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); removeLocalSite(localSiteId); }}
        className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove local site"
      >
        ×
      </button>
      <Handle type="target" position={Position.Left} className="!bg-equinix-black !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-equinix-black !w-2 !h-2" />
    </div>
  );
});
