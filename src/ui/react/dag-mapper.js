/**
 * Map domain ideas + edges to React Flow nodes/edges.
 * @param {import('../../domain/ideas/idea-node.js').IdeaNode[]} ideas
 * @param {Array<{ id: string, source: string, target: string }>} edges
 * @param {Record<string, 'ready'|'waiting'|'completed'>} statusById
 */
export function mapIdeasToFlow(ideas, edges, statusById) {
  const nodes = (ideas || []).map((idea, i) => {
    const position =
      idea.position && typeof idea.position.x === 'number'
        ? { x: idea.position.x, y: idea.position.y }
        : { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 };

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

  const rfEdges = (edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: false,
    style: { stroke: '#929a9e' },
    markerEnd: { type: 'arrowclosed', color: '#929a9e' }
  }));

  return { nodes, edges: rfEdges };
}
