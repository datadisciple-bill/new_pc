import { useState, useRef, useCallback } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type EdgeProps,
} from '@xyflow/react';

interface CustomEdgeData {
  labelLine1: string;
  labelLine2?: string;
  showPricing?: boolean;
  isSameMetro?: boolean;
  [key: string]: unknown;
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = (data ?? {}) as CustomEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  // Draggable offset for the label
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };

    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: startOffset.current.x + (me.clientX - startMouse.current.x),
        y: startOffset.current.y + (me.clientY - startMouse.current.y),
      });
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [offset]);

  const hasLabel = edgeData.labelLine1;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + offset.x}px, ${labelY + offset.y}px)`,
              pointerEvents: 'all',
              cursor: 'grab',
              userSelect: 'none',
            }}
            onMouseDown={onMouseDown}
          >
            <div
              className="bg-white border border-gray-300 rounded px-1.5 py-0.5 shadow-sm text-center"
              style={{ minWidth: 40 }}
            >
              <div className="text-[9px] font-bold text-gray-800 leading-tight">
                {edgeData.labelLine1}
              </div>
              {edgeData.labelLine2 && (
                <div className="text-[9px] font-medium leading-tight" style={{ color: '#33A85C' }}>
                  {edgeData.labelLine2}
                </div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
