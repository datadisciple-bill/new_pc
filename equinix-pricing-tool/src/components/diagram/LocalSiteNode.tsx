import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';
import type { LocalSiteIcon } from '@/types/config';
import fabricPortIcon from '@/assets/icons/fabric-port.svg';
import networkEdgeIcon from '@/assets/icons/network-edge.svg';
import internetAccessIcon from '@/assets/icons/internet-access.svg';
import cloudRouterIcon from '@/assets/icons/cloud-router.svg';
import colocationIcon from '@/assets/icons/colocation.svg';
import buildingCorporateIcon from '@/assets/icons/building-corporate.svg';
import buildingFactoryIcon from '@/assets/icons/building-factory.svg';
import buildingHomeIcon from '@/assets/icons/building-home.svg';
import peopleUserIcon from '@/assets/icons/people-user.svg';

interface LocalSiteNodeData {
  localSiteId: string;
  name: string;
  description: string;
  icon: LocalSiteIcon;
  [key: string]: unknown;
}

const ICON_OPTIONS: { key: LocalSiteIcon; label: string; src: string }[] = [
  { key: 'colocation', label: 'Data Center', src: colocationIcon },
  { key: 'building-corporate', label: 'Corporate / Enterprise', src: buildingCorporateIcon },
  { key: 'building-factory', label: 'Factory / Manufacturing', src: buildingFactoryIcon },
  { key: 'building-home', label: 'Home / Branch Office', src: buildingHomeIcon },
  { key: 'people-user', label: 'User / People', src: peopleUserIcon },
  { key: 'network-edge', label: 'Network Device', src: networkEdgeIcon },
  { key: 'fabric-port', label: 'Port', src: fabricPortIcon },
  { key: 'internet-access', label: 'Internet / Globe', src: internetAccessIcon },
  { key: 'cloud-router', label: 'Router', src: cloudRouterIcon },
];

function getIconSrc(icon: LocalSiteIcon): string {
  return ICON_OPTIONS.find((o) => o.key === icon)?.src ?? colocationIcon;
}

export const LocalSiteNode = memo(function LocalSiteNode({ data, selected }: NodeProps) {
  const { localSiteId, name, description, icon } = data as LocalSiteNodeData;
  const updateLocalSite = useConfigStore((s) => s.updateLocalSite);
  const removeLocalSite = useConfigStore((s) => s.removeLocalSite);

  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [localName, setLocalName] = useState(name);
  const [localDesc, setLocalDesc] = useState(description ?? '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalName(name); }, [name]);
  useEffect(() => { setLocalDesc(description ?? ''); }, [description]);
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);
  useEffect(() => {
    if (editingDesc && descInputRef.current) {
      descInputRef.current.focus();
      descInputRef.current.select();
    }
  }, [editingDesc]);

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

  const handleNameBlur = useCallback(() => {
    setEditingName(false);
    updateLocalSite(localSiteId, { name: localName });
  }, [localSiteId, localName, updateLocalSite]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingName(false);
      updateLocalSite(localSiteId, { name: localName });
    }
  }, [localSiteId, localName, updateLocalSite]);

  const handleDescBlur = useCallback(() => {
    setEditingDesc(false);
    updateLocalSite(localSiteId, { description: localDesc });
  }, [localSiteId, localDesc, updateLocalSite]);

  const handleDescKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingDesc(false);
      updateLocalSite(localSiteId, { description: localDesc });
    }
  }, [localSiteId, localDesc, updateLocalSite]);

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
          {editingName ? (
            <input
              ref={nameInputRef}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="flex-1 min-w-0 text-[10px] font-bold text-white bg-transparent border-b border-gray-400 outline-none px-0"
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
        {/* White body area — editable description */}
        <div className="bg-white px-2 py-1">
          {editingDesc ? (
            <input
              ref={descInputRef}
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onBlur={handleDescBlur}
              onKeyDown={handleDescKeyDown}
              className="w-full text-[9px] text-gray-600 bg-transparent border-b border-gray-300 outline-none px-0"
            />
          ) : (
            <p
              className="text-[9px] text-gray-600 truncate cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingDesc(true); }}
            >
              {description || 'Double-click to add description'}
            </p>
          )}
        </div>
      </div>

      {/* Icon picker dropdown */}
      {showIconPicker && (
        <div
          ref={pickerRef}
          className="absolute top-8 left-0 z-50 bg-white rounded-md shadow-lg border border-gray-200 p-1.5 flex flex-col gap-0.5"
          style={{ minWidth: 160 }}
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
