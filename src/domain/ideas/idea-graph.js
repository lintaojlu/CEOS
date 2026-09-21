/**
 * @typedef {import('./idea-node.js').IdeaNode} IdeaNode
 * @typedef {import('./idea-node.js').TaskRef} TaskRef
 */

/**
 * @param {IdeaNode[]} nodes
 * @returns {Map<string, IdeaNode>}
 */
export function indexIdeasById(nodes) {
  const map = new Map();
  (nodes || []).forEach((n) => map.set(n.id, n));
  return map;
}

/**
 * Build reverse edges: ideaId -> ideaIds that depend on it (idea-scope only).
 * @param {IdeaNode[]} nodes
 * @returns {Map<string, string[]>}
 */
export function buildIdeaSuccessorIndex(nodes) {
  /** @type {Map<string, string[]>} */
  const map = new Map();
  (nodes || []).forEach((n) => {
    (n.dependsOn || []).forEach((ref) => {
      if (ref.scope !== 'idea') return;
      if (!map.has(ref.id)) map.set(ref.id, []);
      map.get(ref.id).push(n.id);
    });
  });
  return map;
}

/**
 * @param {IdeaNode[]} nodes
 * @param {string} id
 * @returns {IdeaNode|undefined}
 */
export function findIdeaById(nodes, id) {
  return (nodes || []).find((n) => n.id === id);
}
