import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';

interface LocalSiteNodeData {
  localSiteId: string;
  name: string;
  [key: string]: unknown;
}

export const LocalSiteNode = memo(function LocalSiteNode({ data, selected }: NodeProps) {
  const { localSiteId, name } = data as LocalSiteNodeData;
  const updateLocalSite = useConfigStore((s) => s.updateLocalSite);
  const removeLocalSite = useConfigStore((s) => s.removeLocalSite);

  const [editing, setEditing] = useState(false);
  const [localName, setLocalName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalName(name); }, [name]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

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

  return (
    <div
      className="relative group"
      style={{ width: 160, height: 64 }}
    >
      <div
        className={`w-full h-full rounded-lg border-2 bg-gray-100 flex flex-col items-center justify-center gap-1 ${
          selected ? 'border-blue-400 shadow-md' : 'border-gray-400'
        }`}
        onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        {/* Building icon */}
        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
        {editing ? (
          <input
            ref={inputRef}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-[130px] text-center text-[10px] font-bold text-gray-700 bg-white border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
          />
        ) : (
          <span className="text-[10px] font-bold text-gray-700 truncate max-w-[140px]">{name}</span>
        )}
      </div>
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); removeLocalSite(localSiteId); }}
        className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove local site"
      >
        ×
      </button>
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-2 !h-2 !border-gray-600" />
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-2 !h-2 !border-gray-600" />
    </div>
  );
});
