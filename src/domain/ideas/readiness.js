/**
 * 未完成的都可以捡起。没有截止日期，也没有前序。
 * @param {any} node
 * @returns {{ waitingDueDate: null }}
 */
export function getBlockers(node) {
  void node;
  return { waitingDueDate: null };
}

/**
 * @param {any} node
 * @param {{ todayKey?: string }} ctx
 * @returns {boolean}
 */
export function isIdeaReady(node, ctx) {
  if (!node || node.completed) return false;
  return !getBlockers(node, ctx).waitingDueDate;
}

/**
 * @param {any[]} nodes
 * @param {{ todayKey?: string }} ctx
 * @returns {{ ready: any[], waiting: any[], completed: any[] }}
 */
export function partitionIdeas(nodes, ctx) {
  const ready = [];
  const waiting = [];
  const completed = [];
  for (const node of nodes || []) {
    if (!node) continue;
    if (node.completed) completed.push(node);
    else if (isIdeaReady(node, ctx)) ready.push(node);
    else waiting.push(node);
  }
  const byCreated = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  ready.sort(byCreated);
  waiting.sort(byCreated);
  completed.sort(byCreated);
  return { ready, waiting, completed };
}
