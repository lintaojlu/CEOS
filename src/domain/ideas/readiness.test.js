import { describe, expect, it } from 'vitest';
import { createIdeaNode } from './idea-node.js';
import { getBlockers, isIdeaReady, partitionIdeas } from './readiness.js';

describe('readiness', () => {
  const todayKey = '2026-09-17';

  it('treats an open idea as ready', () => {
    const node = createIdeaNode({ id: 'a', text: 'A' });
    const ctx = { schedule: {}, ideas: [node], todayKey };
    expect(isIdeaReady(node, ctx)).toBe(true);
    expect(getBlockers(node).waitingDueDate).toBeNull();
  });

  it('does not block on a stored due date', () => {
    const node = createIdeaNode({ id: 'a', text: 'A', dueDate: '2099-01-01' });
    expect(isIdeaReady(node, { schedule: {}, ideas: [node], todayKey })).toBe(true);
  });

  it('archived ideas are not ready', () => {
    const node = createIdeaNode({ id: 'a', text: 'A', archived: true });
    expect(isIdeaReady(node, { schedule: {}, ideas: [node], todayKey })).toBe(false);
  });

  it('partition separates normal and archived', () => {
    const ready = createIdeaNode({ id: 'r', text: 'R', createdAt: 2 });
    const also = createIdeaNode({ id: 'w', text: 'W', dueDate: '2099-01-01', createdAt: 1 });
    const shelved = createIdeaNode({ id: 'd', text: 'D', archived: true });
    const parts = partitionIdeas([ready, also, shelved], {
      schedule: {},
      ideas: [ready, also, shelved],
      todayKey
    });
    expect(parts.ready.map((n) => n.id)).toEqual(['r', 'w']);
    expect(parts.waiting).toEqual([]);
    expect(parts.archived.map((n) => n.id)).toEqual(['d']);
  });
});
