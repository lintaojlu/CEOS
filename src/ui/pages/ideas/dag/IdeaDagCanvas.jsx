import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  ConnectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { IdeaFlowNode } from './IdeaFlowNode.jsx';

const nodeTypes = { ideaNode: IdeaFlowNode };

function FitViewWhenVisible({ active }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!active) return undefined;
    const id = window.setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
    return () => window.clearTimeout(id);
  }, [active, fitView]);
  return null;
}

function IdeaDagCanvasInner({
  initialNodes,
  initialEdges,
  revision,
  visible,
  onPositionChange,
  onConnectEdge,
  onRemoveEdge,
  onPickUp,
  onEdit
}) {
  const decoratedNodes = useMemo(
    () => initialNodes.map((node) => ({ ...node, data: { ...node.data, onPickUp, onEdit } })),
    [initialNodes, onPickUp, onEdit]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(decoratedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(decoratedNodes);
    setEdges(initialEdges);
  }, [revision, decoratedNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) return;
    const result = onConnectEdge(connection.source, connection.target);
    if (result && result.error) window.alert(result.error);
  }, [onConnectEdge]);

  return (
    <div className="ideas-dag-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={(_event, node) => onPositionChange(node.id, node.position)}
        onEdgesDelete={(deleted) => deleted.forEach((edge) => onRemoveEdge(edge.source, edge.target))}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionRadius={28}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed, color: '#929a9e' } }}
      >
        <FitViewWhenVisible active={visible} />
        <Background color="rgba(0,0,0,0.08)" gap={18} size={1} />
        <Controls />
        <MiniMap
          maskColor="rgba(255,255,255,0.72)"
          nodeStrokeWidth={0}
          nodeColor={(node) => {
            if (node.data?.status === 'ready') return '#111111';
            if (node.data?.status === 'waiting') return '#a1a1aa';
            return '#e4e4e7';
          }}
        />
      </ReactFlow>
    </div>
  );
}

export function IdeaDagCanvas(props) {
  return (
    <ReactFlowProvider>
      <IdeaDagCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
