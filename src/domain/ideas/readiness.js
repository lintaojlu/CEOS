import { findIdeaById } from './idea-graph.js';

/**
 * @typedef {import('./idea-node.js').IdeaNode} IdeaNode
 * @typedef {import('./idea-node.js').TaskRef} TaskRef
 * @typedef {import('../schedule/schedule-day.js').ScheduleDay} ScheduleDay
 */

/**
 * @typedef {Object} ReadinessContext
 * @property {Record<string, ScheduleDay>} schedule
 * @property {IdeaNode[]} ideas - same-day ideas only (days are decoupled)
 * @property {string} todayKey - wall-clock today (for DDL)
 * @property {string} [dayKey] - the schedule day these ideas belong to
 */

/**
 * Missing refs are treated as satisfied.
 * Cross-day daily refs do not block — each day is independent.
 * @param {TaskRef} ref
 * @param {ReadinessContext} ctx
 * @returns {boolean}
 */
export function isRefSatisfied(ref, ctx) {
  if (!ref) return true;
  if (ref.scope === 'idea') {
    const idea = findIdeaById(ctx.ideas, ref.id);
    if (!idea) return true;
    return !!idea.completed;
  }
  if (ref.scope === 'daily') {
    if (ctx.dayKey && ref.dateKey && ref.dateKey !== ctx.dayKey) return true;
    const lookupKey = ctx.dayKey || ref.dateKey;
    const day = ctx.schedule[lookupKey];
    if (!day) return true;
    const list = day[ref.list] || [];
    const task = list.find((t) => t.id === ref.id);
    if (!task) return true;
    return !!task.completed;
  }
  return true;
}

/**
 * @param {IdeaNode} node
 * @param {ReadinessContext} ctx
 * @returns {{ waitingPreds: TaskRef[], waitingDueDate: string|null, missingPreds: TaskRef[] }}
 */
export function getBlockers(node, ctx) {
  const waitingPreds = [];
  const missingPreds = [];
  for (const ref of node.dependsOn || []) {
    if (ref.scope === 'idea') {
      const idea = findIdeaById(ctx.ideas, ref.id);
      if (!idea) {
        missingPreds.push(ref);
        continue;
      }
      if (!idea.completed) waitingPreds.push(ref);
    } else if (ref.scope === 'daily') {
      if (ctx.dayKey && ref.dateKey && ref.dateKey !== ctx.dayKey) {
        missingPreds.push(ref);
        continue;
      }
      const lookupKey = ctx.dayKey || ref.dateKey;
      const day = ctx.schedule[lookupKey];
      const list = day ? day[ref.list] || [] : [];
      const task = list.find((t) => t.id === ref.id);
      if (!task) {
        missingPreds.push(ref);
        continue;
      }
      if (!task.completed) waitingPreds.push(ref);
    }
  }

  let waitingDueDate = null;
  if (node.dueDate && node.dueDate > ctx.todayKey) {
    waitingDueDate = node.dueDate;
  }

  return { waitingPreds, waitingDueDate, missingPreds };
}

/**
 * @param {IdeaNode} node
 * @param {ReadinessContext} ctx
 * @returns {boolean}
 */
export function isIdeaReady(node, ctx) {
  if (!node || node.completed) return false;
  const blockers = getBlockers(node, ctx);
  if (blockers.waitingPreds.length > 0) return false;
  if (blockers.waitingDueDate) return false;
  return true;
}

/**
 * @param {IdeaNode[]} nodes
 * @param {ReadinessContext} ctx
 * @returns {{ ready: IdeaNode[], waiting: IdeaNode[], completed: IdeaNode[] }}
 */
export function partitionIdeas(nodes, ctx) {
  const ready = [];
  const waiting = [];
  const completed = [];
  for (const n of nodes || []) {
    if (n.completed) {
      completed.push(n);
    } else if (isIdeaReady(n, ctx)) {
      ready.push(n);
    } else {
      waiting.push(n);
    }
  }
  const byPinThenCreated = (a, b) => {
    if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.createdAt || 0) - (a.createdAt || 0);
  };
  ready.sort(byPinThenCreated);
  waiting.sort(byPinThenCreated);
  completed.sort(byPinThenCreated);
  return { ready, waiting, completed };
}
