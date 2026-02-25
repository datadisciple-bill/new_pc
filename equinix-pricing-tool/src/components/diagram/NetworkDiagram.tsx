import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useConfigStore } from '@/store/configStore';
import { buildDiagramLayout } from '@/utils/diagramLayout';
import { MetroNode } from './MetroNode';
import { ServiceNode } from './ServiceNode';
import { CloudNode } from './CloudNode';
import { PriceTableNode } from './PriceTableNode';
import { DiagramLegend } from './DiagramLegend';

const nodeTypes: NodeTypes = {
  metroNode: MetroNode,
  serviceNode: ServiceNode,
  cloudNode: CloudNode,
  priceTableNode: PriceTableNode,
};

export function NetworkDiagram() {
  const metros = useConfigStore((s) => s.project.metros);
  const connections = useConfigStore((s) => s.project.connections);

  const { nodes, edges } = useMemo(
    () => buildDiagramLayout(metros, connections),
    [metros, connections]
  );

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
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
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls position="top-right" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'metroNode') return '#F4F4F4';
            if (node.type === 'cloudNode') return '#FF9900';
            return '#000000';
          }}
          position="bottom-right"
          style={{ border: '1px solid #e5e7eb' }}
        />
      </ReactFlow>
      <DiagramLegend />
    </div>
  );
}
