import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';
import type { AnnotationMarker } from '@/types/config';

interface AnnotationLegendNodeData {
  markers: AnnotationMarker[];
  [key: string]: unknown;
}

export const AnnotationLegendNode = memo(function AnnotationLegendNode({ data }: NodeProps) {
  const { markers } = data as AnnotationLegendNodeData;
  const updateAnnotationMarker = useConfigStore((s) => s.updateAnnotationMarker);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const startEditing = useCallback((marker: AnnotationMarker) => {
    setEditingId(marker.id);
    setEditText(marker.text);
  }, []);

  const finishEditing = useCallback(() => {
    if (editingId) {
      updateAnnotationMarker(editingId, { text: editText });
      setEditingId(null);
    }
  }, [editingId, editText, updateAnnotationMarker]);

  if (markers.length === 0) return null;

  const sorted = [...markers].sort((a, b) => a.number - b.number);

  return (
    <div
      className="bg-white border border-gray-300 rounded-lg shadow-sm p-2.5"
      style={{ minWidth: 200, maxWidth: 320 }}
    >
      <p className="text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Notes</p>
      <div className="space-y-1">
        {sorted.map((marker) => (
          <div key={marker.id} className="flex items-start gap-2">
            <div
              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold mt-0.5"
              style={{ backgroundColor: marker.color }}
            >
              {marker.number}
            </div>
            {editingId === marker.id ? (
              <input
                ref={inputRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') finishEditing(); }}
                className="flex-1 text-[10px] text-gray-700 border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400 min-w-0"
                placeholder="Add description..."
              />
            ) : (
              <p
                className="flex-1 text-[10px] text-gray-700 leading-snug cursor-pointer hover:text-blue-600 py-0.5"
                onDoubleClick={() => startEditing(marker)}
              >
                {marker.text || <span className="text-gray-400 italic">Double-click to add description...</span>}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
