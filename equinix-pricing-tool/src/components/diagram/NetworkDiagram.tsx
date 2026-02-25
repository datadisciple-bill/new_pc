import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type NodeTypes,
  type EdgeTypes,
  type NodeChange,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useConfigStore } from '@/store/configStore';
import { buildDiagramLayout } from '@/utils/diagramLayout';
import { MetroNode } from './MetroNode';
import { ServiceNode } from './ServiceNode';
import { CloudNode } from './CloudNode';
import { PriceTableNode } from './PriceTableNode';
import { NEPriceTableNode } from './NEPriceTableNode';
import { CustomEdge } from './CustomEdge';
import { DiagramLegend } from './DiagramLegend';

const nodeTypes: NodeTypes = {
  metroNode: MetroNode,
  serviceNode: ServiceNode,
  cloudNode: CloudNode,
  priceTableNode: PriceTableNode,
  nePriceTableNode: NEPriceTableNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

// Node types that can be freely repositioned by dragging
const DRAGGABLE_NODE_TYPES = new Set(['priceTableNode', 'nePriceTableNode', 'cloudNode']);

export function NetworkDiagram() {
  const metros = useConfigStore((s) => s.project.metros);
  const connections = useConfigStore((s) => s.project.connections);
  const showPricing = useConfigStore((s) => s.ui.showPricing);
  const setShowPricing = useConfigStore((s) => s.setShowPricing);
  const undo = useConfigStore((s) => s.undo);
  const canUndo = useConfigStore((s) => s.canUndo);

  // Controlled nodes state — lets price tables and cloud nodes be dragged freely
  const [reactFlowNodes, setReactFlowNodes] = useState<Node[]>([]);
  // Persist positions for draggable nodes across layout recomputes
  const savedPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const { nodes: layoutNodes, edges } = useMemo(
    () => buildDiagramLayout(metros, connections, showPricing),
    [metros, connections, showPricing]
  );

  // Merge saved positions into layout nodes whenever layout changes
  useEffect(() => {
    setReactFlowNodes(
      layoutNodes.map((node) => {
        if (DRAGGABLE_NODE_TYPES.has(node.type ?? '')) {
          const saved = savedPositions.current.get(node.id);
          if (saved) return { ...node, position: saved };
        }
        return node;
      })
    );
  }, [layoutNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setReactFlowNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        // Persist positions of draggable nodes
        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            const node = updated.find((n) => n.id === change.id);
            if (node && DRAGGABLE_NODE_TYPES.has(node.type ?? '')) {
              savedPositions.current.set(change.id, change.position);
            }
          }
        }
        return updated;
      });
    },
    []
  );

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 150);
  }, []);

  if (metros.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select metros and add services to see the diagram
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onInit={onInit}
        fitView
        minZoom={0.1}
        maxZoom={2}
        elevateEdgesOnSelect
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls position="top-right" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'metroNode') return '#dbeafe';
            if (node.type === 'cloudNode') return '#FF9900';
            if (node.type === 'priceTableNode' || node.type === 'nePriceTableNode') return '#d1fae5';
            return '#1f2937';
          }}
          nodeStrokeWidth={2}
          nodeStrokeColor={() => '#6B7280'}
          position="bottom-right"
          style={{ border: '1px solid #e5e7eb', background: '#f9fafb' }}
          maskColor="rgba(0,0,0,0.08)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Toolbar overlay */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowPricing(!showPricing)}
          className={`px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border transition-colors ${
            showPricing
              ? 'bg-equinix-green text-white border-equinix-green'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {showPricing ? '$ Pricing On' : '$ Pricing Off'}
        </button>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo last change (up to 10)"
          className="px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border bg-white border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-gray-50 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Undo
        </button>
      </div>

      <DiagramLegend />
    </div>
  );
}
