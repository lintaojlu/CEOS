/**
 * @typedef {import('./idea-node.js').IdeaNode} IdeaNode
 * @typedef {import('./idea-node.js').TaskRef} TaskRef
 */

/**
 * Detect cycle if ideaId used proposedDeps (idea-scope edges only).
 * @param {IdeaNode[]} nodes
 * @param {string} ideaId
 * @param {TaskRef[]} proposedDeps
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateDependsOn(nodes, ideaId, proposedDeps) {
  const deps = proposedDeps || [];
  for (const ref of deps) {
    if (ref.scope === 'idea' && ref.id === ideaId) {
      return { ok: false, reason: '不能依赖自身' };
    }
  }

  /** @type {Map<string, string[]>} */
  const adj = new Map();
  (nodes || []).forEach((n) => {
    const edges =
      n.id === ideaId
        ? deps.filter((r) => r.scope === 'idea').map((r) => r.id)
        : (n.dependsOn || []).filter((r) => r.scope === 'idea').map((r) => r.id);
    adj.set(n.id, edges);
  });
  if (!adj.has(ideaId)) {
    adj.set(
      ideaId,
      deps.filter((r) => r.scope === 'idea').map((r) => r.id)
    );
  }

  const visiting = new Set();
  const visited = new Set();

  function dfs(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const next = adj.get(id) || [];
    for (const n of next) {
      if (dfs(n)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  if (dfs(ideaId)) {
    return { ok: false, reason: '依赖关系形成环，无法保存' };
  }
  return { ok: true };
}
