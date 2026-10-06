/**
 * 把领域里的灵感和依赖边映射成 React Flow 的节点与边。
 * @param {import('../../../../domain/ideas/idea-node.js').IdeaNode[]} ideas
 * @param {Array<{ id: string, source: string, target: string }>} edges
 * @param {Record<string, 'ready'|'waiting'|'completed'>} statusById
 */
export function mapIdeasToFlow(ideas, edges, statusById) {
  const nodes = (ideas || []).map((idea, index) => {
    const position = idea.position && typeof idea.position.x === 'number'
      ? { x: idea.position.x, y: idea.position.y }
      : { x: (index % 4) * 240, y: Math.floor(index / 4) * 140 };
    return {
      id: idea.id,
      type: 'ideaNode',
      position,
      data: {
        label: idea.text || '',
        dueDate: idea.dueDate,
        status: statusById[idea.id] || (idea.completed ? 'completed' : 'waiting'),
        note: idea.note || '',
        pinned: !!idea.pinned
      }
    };
  });

  const flowEdges = (edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    style: { stroke: '#929a9e' },
    markerEnd: { type: 'arrowclosed', color: '#929a9e' }
  }));

  return { nodes, edges: flowEdges };
}
