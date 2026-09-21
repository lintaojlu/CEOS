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
    if (!active) return;
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      fitView({ padding: 0.2, duration: 200 });
    }, 50);
    return () => window.clearTimeout(id);
  }, [active, fitView]);
  return null;
}

/**
 * @param {object} props
 * @param {import('@xyflow/react').Node[]} props.initialNodes
 * @param {import('@xyflow/react').Edge[]} props.initialEdges
 * @param {number} props.revision
 * @param {boolean} props.visible
 * @param {(id: string, pos: {x:number,y:number}) => void} props.onPositionChange
 * @param {(source: string, target: string) => { error?: string }|void} props.onConnectEdge
 * @param {(source: string, target: string) => void} props.onRemoveEdge
 * @param {(id: string) => void} props.onPickUp
 * @param {(id: string) => void} props.onEdit
 */
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
    () =>
      initialNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onPickUp,
          onEdit
        }
      })),
    [initialNodes, onPickUp, onEdit]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(decoratedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(decoratedNodes);
    setEdges(initialEdges);
  }, [revision, decoratedNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      const result = onConnectEdge(connection.source, connection.target);
      if (result && result.error) {
        alert(result.error);
      }
    },
    [onConnectEdge]
  );

  const onNodeDragStop = useCallback(
    (_event, node) => {
      onPositionChange(node.id, node.position);
    },
    [onPositionChange]
  );

  const onEdgesDelete = useCallback(
    (deleted) => {
      deleted.forEach((e) => {
        if (e.source && e.target) onRemoveEdge(e.source, e.target);
      });
    },
    [onRemoveEdge]
  );

  return (
    <div className="ideas-dag-canvas w-full h-[360px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionRadius={28}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, color: '#929a9e' }
        }}
      >
        <FitViewWhenVisible active={visible} />
        <Background color="rgba(20, 23, 26, 0.18)" gap={18} size={1} />
        <Controls />
        <MiniMap
          maskColor="rgba(239, 242, 241, 0.75)"
          nodeStrokeWidth={0}
          nodeColor={(n) => {
            const s = n.data?.status;
            if (s === 'ready') return '#e14a0e';
            if (s === 'waiting') return '#929a9e';
            return '#d0d3d3';
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
