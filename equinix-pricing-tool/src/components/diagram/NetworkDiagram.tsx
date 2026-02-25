import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  type NodeTypes,
  type EdgeTypes,
  type NodeChange,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { useConfigStore } from '@/store/configStore';
import { buildDiagramLayout } from '@/utils/diagramLayout';
import { MetroNode } from './MetroNode';
import { ServiceNode } from './ServiceNode';
import { CloudNode } from './CloudNode';
import { PriceTableNode } from './PriceTableNode';
import { NEPriceTableNode } from './NEPriceTableNode';
import { TextBoxNode } from './TextBoxNode';
import { CustomEdge } from './CustomEdge';
import { DiagramLegend } from './DiagramLegend';

const nodeTypes: NodeTypes = {
  metroNode: MetroNode,
  serviceNode: ServiceNode,
  cloudNode: CloudNode,
  priceTableNode: PriceTableNode,
  nePriceTableNode: NEPriceTableNode,
  textBoxNode: TextBoxNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

// Node types that can be freely repositioned by dragging
const DRAGGABLE_NODE_TYPES = new Set(['priceTableNode', 'nePriceTableNode', 'cloudNode', 'textBoxNode']);

export function NetworkDiagram() {
  const metros = useConfigStore((s) => s.project.metros);
  const connections = useConfigStore((s) => s.project.connections);
  const textBoxes = useConfigStore((s) => s.project.textBoxes);
  const showPricing = useConfigStore((s) => s.ui.showPricing);
  const setShowPricing = useConfigStore((s) => s.setShowPricing);
  const undo = useConfigStore((s) => s.undo);
  const canUndo = useConfigStore((s) => s.canUndo);
  const addTextBox = useConfigStore((s) => s.addTextBox);
  const updateTextBox = useConfigStore((s) => s.updateTextBox);

  // Controlled nodes state — lets price tables, cloud nodes, and text boxes be dragged freely
  const [reactFlowNodes, setReactFlowNodes] = useState<Node[]>([]);
  // Persist positions for draggable nodes across layout recomputes
  const savedPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const { nodes: layoutNodes, edges } = useMemo(
    () => buildDiagramLayout(metros, connections, showPricing, textBoxes),
    [metros, connections, showPricing, textBoxes]
  );

  // Merge saved positions into layout nodes whenever layout changes
  useEffect(() => {
    const nodesWithSaved = layoutNodes.map((node) => {
      const saved = savedPositions.current.get(node.id);
      if (saved && (DRAGGABLE_NODE_TYPES.has(node.type ?? '') || node.type === 'serviceNode')) {
        return { ...node, position: saved };
      }
      return node;
    });

    // Recompute metro sizes to fit any saved child positions
    const finalNodes = nodesWithSaved.map((node) => {
      if (node.type !== 'metroNode') return node;

      const children = nodesWithSaved.filter((n) => n.parentId === node.id);
      if (children.length === 0) return node;

      const PADDING = 16;
      let maxRight = 0;
      let maxBottom = 0;

      for (const child of children) {
        const cw = (child.style?.width as number) ?? child.width ?? 204;
        const ch = (child.style?.height as number) ?? child.height ?? 72;
        maxRight = Math.max(maxRight, child.position.x + cw);
        maxBottom = Math.max(maxBottom, child.position.y + ch);
      }

      const baseWidth = (node.style?.width as number) ?? node.width ?? 0;
      const baseHeight = (node.style?.height as number) ?? node.height ?? 0;
      const newWidth = Math.max(maxRight + PADDING, baseWidth);
      const newHeight = Math.max(maxBottom + PADDING, baseHeight);

      if (newWidth !== baseWidth || newHeight !== baseHeight) {
        return {
          ...node,
          style: { ...node.style, width: newWidth, height: newHeight },
          width: newWidth,
          height: newHeight,
        };
      }
      return node;
    });

    setReactFlowNodes(finalNodes);
  }, [layoutNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setReactFlowNodes((nds) => {
        const applied = applyNodeChanges(changes, nds) as Node[];

        const metrosToResize = new Set<string>();

        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            const node = applied.find((n) => n.id === change.id);
            if (!node) continue;

            // Persist positions for draggable standalone nodes
            if (DRAGGABLE_NODE_TYPES.has(node.type ?? '')) {
              savedPositions.current.set(change.id, change.position);
              if (node.type === 'textBoxNode' && change.dragging === false) {
                const tbId = (node.data as { textBoxId: string }).textBoxId;
                updateTextBox(tbId, { x: change.position.x, y: change.position.y });
              }
            }

            // Track service node position changes → resize parent metro
            if (node.type === 'serviceNode' && node.parentId) {
              savedPositions.current.set(change.id, change.position);
              metrosToResize.add(node.parentId);
            }
          }
        }

        // Dynamically resize metro containers to fit all child service nodes
        if (metrosToResize.size > 0) {
          return applied.map((node) => {
            if (!metrosToResize.has(node.id) || node.type !== 'metroNode') return node;

            const children = applied.filter((n) => n.parentId === node.id);
            if (children.length === 0) return node;

            const PAD = 16;
            let maxRight = 0;
            let maxBottom = 0;

            for (const child of children) {
              const cw = child.width ?? 204;
              const ch = child.height ?? 72;
              maxRight = Math.max(maxRight, child.position.x + cw);
              maxBottom = Math.max(maxBottom, child.position.y + ch);
            }

            const newWidth = Math.max(maxRight + PAD, node.width ?? 0);
            const newHeight = Math.max(maxBottom + PAD, node.height ?? 0);

            return {
              ...node,
              style: { ...node.style, width: newWidth, height: newHeight },
              width: newWidth,
              height: newHeight,
            };
          });
        }

        return applied;
      });
    },
    [updateTextBox]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    setTimeout(() => instance.fitView(), 150);
  }, []);

  // Align to grid — reset all draggable positions to computed layout
  const handleAlignToGrid = useCallback(() => {
    savedPositions.current.clear();
    setReactFlowNodes(layoutNodes);
    setTimeout(() => rfInstanceRef.current?.fitView(), 50);
  }, [layoutNodes]);

  // Add text box at center of viewport
  const handleAddTextBox = useCallback(() => {
    const instance = rfInstanceRef.current;
    if (instance) {
      const viewport = instance.getViewport();
      const wrapper = reactFlowWrapper.current;
      const centerX = wrapper ? wrapper.clientWidth / 2 : 400;
      const centerY = wrapper ? wrapper.clientHeight / 2 : 300;
      // Convert screen coords to flow coords
      const flowX = (centerX - viewport.x) / viewport.zoom;
      const flowY = (centerY - viewport.y) / viewport.zoom;
      addTextBox(flowX - 80, flowY - 20);
    } else {
      addTextBox(100, 100);
    }
  }, [addTextBox]);

  // Export diagram as PNG — cropped to content bounds
  const handleExportPng = useCallback(async () => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    const instance = rfInstanceRef.current;
    if (!el || !instance) return;

    const nodes = instance.getNodes();
    if (nodes.length === 0) return;

    // Save current viewport to restore after export
    const prevViewport = instance.getViewport();

    try {
      const PADDING = 40;
      const bounds = getNodesBounds(nodes);
      const exportWidth = bounds.width + PADDING * 2;
      const exportHeight = bounds.height + PADDING * 2;

      // Compute viewport that fits all nodes into the export dimensions
      const viewport = getViewportForBounds(bounds, exportWidth, exportHeight, 0.1, 2, PADDING);
      instance.setViewport(viewport);

      // Wait for the viewport change to render
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        width: exportWidth,
        height: exportHeight,
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement) {
            const cls = node.className ?? '';
            if (typeof cls === 'string') {
              if (cls.includes('react-flow__controls')) return false;
              if (cls.includes('react-flow__minimap')) return false;
              if (cls.includes('diagram-toolbar')) return false;
              if (cls.includes('diagram-legend')) return false;
            }
          }
          return true;
        },
      });
      const link = document.createElement('a');
      link.download = `equinix-diagram-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      // Restore previous viewport
      instance.setViewport(prevViewport);
    }
  }, []);

  if (metros.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select metros and add services to see the diagram
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" ref={reactFlowWrapper}>
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
            if (node.type === 'textBoxNode') return '#fef3c7';
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
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 diagram-toolbar flex-wrap">
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
        <button
          onClick={handleAlignToGrid}
          title="Reset layout positions"
          className="px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border bg-white border-gray-300 transition-colors hover:bg-gray-50 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
          Align
        </button>
        <button
          onClick={handleAddTextBox}
          title="Add a text annotation"
          className="px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border bg-white border-gray-300 transition-colors hover:bg-gray-50 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Text
        </button>
        <button
          onClick={handleExportPng}
          title="Export diagram as PNG"
          className="px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border bg-white border-gray-300 transition-colors hover:bg-gray-50 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PNG
        </button>
      </div>

      <DiagramLegend />
    </div>
  );
}
