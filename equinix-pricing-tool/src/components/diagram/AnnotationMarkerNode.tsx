import { memo, useState, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';

const MARKER_COLORS = [
  { label: 'Red', value: '#E91C24' },
  { label: 'Blue', value: '#0067B8' },
  { label: 'Green', value: '#33A85C' },
  { label: 'Orange', value: '#FF9900' },
  { label: 'Purple', value: '#7B2D8E' },
  { label: 'Black', value: '#000000' },
];

interface AnnotationMarkerNodeData {
  markerId: string;
  number: number;
  color: string;
  [key: string]: unknown;
}

export const AnnotationMarkerNode = memo(function AnnotationMarkerNode({ data, selected }: NodeProps) {
  const { markerId, number, color } = data as AnnotationMarkerNodeData;
  const updateAnnotationMarker = useConfigStore((s) => s.updateAnnotationMarker);
  const removeAnnotationMarker = useConfigStore((s) => s.removeAnnotationMarker);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleColorChange = useCallback((newColor: string) => {
    updateAnnotationMarker(markerId, { color: newColor });
    setShowColorPicker(false);
  }, [markerId, updateAnnotationMarker]);

  return (
    <div className="relative group" style={{ width: 28, height: 28 }}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold cursor-pointer shadow-sm"
        style={{
          backgroundColor: color,
          border: selected ? '2px solid #3B82F6' : '2px solid white',
          boxShadow: selected ? '0 0 0 1px #3B82F6' : '0 1px 2px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
      >
        {number}
      </div>
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); removeAnnotationMarker(markerId); }}
        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove marker"
      >
        ×
      </button>
      {/* Color picker dropdown */}
      {showColorPicker && (
        <div
          className="absolute top-8 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 z-50 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {MARKER_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => handleColorChange(c.value)}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c.value,
                borderColor: c.value === color ? '#3B82F6' : '#e5e7eb',
              }}
              title={c.label}
            />
          ))}
        </div>
      )}
    </div>
  );
});
