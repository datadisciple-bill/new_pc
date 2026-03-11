import { useState, useRef, useCallback, useEffect } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type EdgeProps,
} from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';
import type { HandleSide } from '@/types/config';

interface CustomEdgeData {
  connectionId?: string;
  labelLine1: string;
  labelLine2?: string;
  showPricing?: boolean;
  isSameMetro?: boolean;
  isRedundant?: boolean;
  [key: string]: unknown;
}

const HANDLE_SIDES: { side: HandleSide; label: string; icon: string }[] = [
  { side: 'left', label: 'Left', icon: '←' },
  { side: 'right', label: 'Right', icon: '→' },
  { side: 'top', label: 'Top', icon: '↑' },
  { side: 'bottom', label: 'Bottom', icon: '↓' },
];

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
  const removeConnection = useConfigStore((s) => s.removeConnection);
  const highlightConnection = useConfigStore((s) => s.highlightConnection);
  const updateConnection = useConfigStore((s) => s.updateConnection);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  // Draggable offset for the label
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  // Hover and confirm-delete state
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss confirmation after 4s
  useEffect(() => {
    if (confirming) {
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000);
    }
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [confirming]);

  // Handle pin menu state
  const [showPinMenu, setShowPinMenu] = useState(false);
  const pinMenuRef = useRef<HTMLDivElement>(null);

  // Close pin menu on outside click — use capture phase to catch clicks before React Flow swallows them
  useEffect(() => {
    if (!showPinMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (pinMenuRef.current && !pinMenuRef.current.contains(e.target as Node)) {
        setShowPinMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [showPinMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!edgeData.connectionId) return;
    e.preventDefault();
    e.stopPropagation();
    setShowPinMenu(true);
  }, [edgeData.connectionId]);

  const handlePinHandle = useCallback((endpoint: 'aSide' | 'zSide', side: HandleSide) => {
    if (!edgeData.connectionId) return;
    const conn = useConfigStore.getState().project.connections.find((c) => c.id === edgeData.connectionId);
    if (!conn) return;
    updateConnection(edgeData.connectionId, {
      [endpoint]: { ...conn[endpoint], handleSide: side },
    });
    setShowPinMenu(false);
  }, [edgeData.connectionId, updateConnection]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // If pin menu is open, close it instead of starting a drag
    if (showPinMenu) {
      setShowPinMenu(false);
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    didDrag.current = false;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };

    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const dx = me.clientX - startMouse.current.x;
      const dy = me.clientY - startMouse.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setOffset({
        x: startOffset.current.x + dx,
        y: startOffset.current.y + dy,
      });
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // If the mouse didn't move, treat as a click → highlight the connection
      if (!didDrag.current && edgeData.connectionId) {
        highlightConnection(edgeData.connectionId);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [offset, edgeData.connectionId, highlightConnection, showPinMenu]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(true);
  }, []);

  const handleConfirm = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (edgeData.connectionId) {
      removeConnection(edgeData.connectionId);
    }
    setConfirming(false);
  }, [edgeData.connectionId, removeConnection]);

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(false);
  }, []);

  const hasLabel = edgeData.labelLine1;
  const isRedundant = edgeData.isRedundant === true;
  const canDelete = !!edgeData.connectionId;

  // Double-line effect: outer thick stroke + white inner stroke
  const strokeColor = (style?.stroke as string) ?? '#000000';
  const dashArray = style?.strokeDasharray as string | undefined;

  return (
    <>
      {isRedundant ? (
        <>
          {/* Outer thick stroke */}
          <BaseEdge id={id} path={edgePath} style={{ ...style, strokeWidth: 5, pointerEvents: 'none' }} markerEnd={markerEnd} />
          {/* White inner gap to create double-line effect */}
          <path
            d={edgePath}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeDasharray={dashArray}
            style={{ pointerEvents: 'none' }}
          />
        </>
      ) : (
        <BaseEdge id={id} path={edgePath} style={{ ...style, stroke: strokeColor, strokeWidth: 1.5 }} markerEnd={markerEnd} />
      )}
      {/* Invisible wider hit area for hover detection on the edge path */}
      {canDelete && !hasLabel && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { if (!confirming) setHovered(false); }}
        />
      )}
      {/* Label + delete button rendered via EdgeLabelRenderer */}
      {(hasLabel || ((hovered || confirming) && canDelete)) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + offset.x}px, ${labelY + offset.y}px)`,
              zIndex: 1000,
              pointerEvents: 'all',
              cursor: hasLabel ? 'grab' : 'default',
              userSelect: 'none',
            }}
            onMouseDown={hasLabel ? onMouseDown : undefined}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { if (!confirming && !showPinMenu) setHovered(false); }}
          >
            <div
              className="bg-white border border-gray-300 rounded px-1.5 py-0.5 shadow-sm text-center relative group"
              style={{ minWidth: 40 }}
            >
              {hasLabel && (
                <>
                  <div className="text-[9px] font-bold text-gray-800 leading-tight">
                    {edgeData.labelLine1}
                  </div>
                  {edgeData.labelLine2 && (
                    <div className="text-[9px] font-medium leading-tight" style={{ color: '#33A85C' }}>
                      {edgeData.labelLine2}
                    </div>
                  )}
                </>
              )}
              {/* Delete button / confirmation */}
              {canDelete && !confirming && hovered && (
                <button
                  onClick={handleDeleteClick}
                  className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center shadow-sm transition-colors"
                  title="Delete connection"
                >
                  ×
                </button>
              )}
              {canDelete && confirming && (
                <div className="flex items-center gap-1 mt-0.5 pt-0.5 border-t border-gray-200">
                  <span className="text-[9px] text-gray-600 font-medium whitespace-nowrap">Delete?</span>
                  <button
                    onClick={handleCancel}
                    className="text-[9px] px-1 py-px rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium"
                  >
                    No
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="text-[9px] px-1 py-px rounded bg-red-500 hover:bg-red-600 text-white font-medium"
                  >
                    Yes
                  </button>
                </div>
              )}
              {/* Handle pin menu — right-click to change which side connections attach to */}
              {showPinMenu && edgeData.connectionId && (
                <div
                  ref={pinMenuRef}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[9px] font-bold text-blue-600 mb-1 px-1">A-Side (Source)</div>
                  <div className="flex gap-0.5 mb-2">
                    {HANDLE_SIDES.map(({ side, label, icon }) => (
                      <button
                        key={`a-${side}`}
                        onClick={() => handlePinHandle('aSide', side)}
                        title={`Attach source to ${label.toLowerCase()}`}
                        className="flex-1 text-[10px] px-1 py-1 rounded text-center hover:bg-blue-50 hover:text-blue-700 border border-gray-100 transition-colors"
                      >
                        <span className="block text-xs">{icon}</span>
                        <span className="block text-[8px] text-gray-400">{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] font-bold text-green-600 mb-1 px-1">Z-Side (Target)</div>
                  <div className="flex gap-0.5">
                    {HANDLE_SIDES.map(({ side, label, icon }) => (
                      <button
                        key={`z-${side}`}
                        onClick={() => handlePinHandle('zSide', side)}
                        title={`Attach target to ${label.toLowerCase()}`}
                        className="flex-1 text-[10px] px-1 py-1 rounded text-center hover:bg-green-50 hover:text-green-700 border border-gray-100 transition-colors"
                      >
                        <span className="block text-xs">{icon}</span>
                        <span className="block text-[8px] text-gray-400">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* A-Side / Z-Side endpoint labels — shown only when pin menu is open */}
      {showPinMenu && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${sourceX}px, ${sourceY - 4}px)`,
              zIndex: 1001,
              pointerEvents: 'none',
            }}
          >
            <span className="text-[8px] font-bold text-white bg-blue-600 rounded px-1 py-px shadow">A-Side</span>
          </div>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${targetX}px, ${targetY - 4}px)`,
              zIndex: 1001,
              pointerEvents: 'none',
            }}
          >
            <span className="text-[8px] font-bold text-white bg-green-600 rounded px-1 py-px shadow">Z-Side</span>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Floating delete for edges without labels — shows mid-path on hover */}
      {!hasLabel && (hovered || confirming) && canDelete && !confirming && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { if (!confirming) setHovered(false); }}
          >
            <button
              onClick={handleDeleteClick}
              className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm transition-colors"
              title="Delete connection"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Confirmation popup for edges without labels */}
      {!hasLabel && confirming && canDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {}}
          >
            <div className="bg-white border border-gray-300 rounded px-2 py-1.5 shadow-md flex items-center gap-1.5">
              <span className="text-[10px] text-gray-600 font-medium whitespace-nowrap">Delete connection?</span>
              <button
                onClick={handleCancel}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium"
              >
                No
              </button>
              <button
                onClick={handleConfirm}
                className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 hover:bg-red-600 text-white font-medium"
              >
                Yes
              </button>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
