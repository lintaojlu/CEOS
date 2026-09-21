import { describe, it, expect } from 'vitest';
import { createIdeaNode } from './idea-node.js';
import { isIdeaReady, getBlockers, isRefSatisfied, partitionIdeas } from './readiness.js';

describe('readiness', () => {
  const todayKey = '2026-09-17';

  it('ready when no deps and no dueDate', () => {
    const node = createIdeaNode({ id: 'a', text: 'A' });
    const ctx = { schedule: {}, ideas: [node], todayKey };
    expect(isIdeaReady(node, ctx)).toBe(true);
  });

  it('blocked by future dueDate', () => {
    const node = createIdeaNode({ id: 'a', text: 'A', dueDate: '2026-09-20' });
    const ctx = { schedule: {}, ideas: [node], todayKey };
    expect(isIdeaReady(node, ctx)).toBe(false);
    expect(getBlockers(node, ctx).waitingDueDate).toBe('2026-09-20');
  });

  it('ready when dueDate is today', () => {
    const node = createIdeaNode({ id: 'a', text: 'A', dueDate: todayKey });
    const ctx = { schedule: {}, ideas: [node], todayKey };
    expect(isIdeaReady(node, ctx)).toBe(true);
  });

  it('blocked by incomplete same-day daily predecessor', () => {
    const node = createIdeaNode({
      id: 'a',
      text: 'A',
      dependsOn: [{ scope: 'daily', dateKey: todayKey, list: 'required', id: 't1' }]
    });
    const ctx = {
      schedule: {
        [todayKey]: {
          required: [{ id: 't1', text: 'T', completed: false }],
          optional: []
        }
      },
      ideas: [node],
      todayKey,
      dayKey: todayKey
    };
    expect(isIdeaReady(node, ctx)).toBe(false);
    expect(getBlockers(node, ctx).waitingPreds).toHaveLength(1);
  });

  it('ready when same-day daily predecessor completed', () => {
    const node = createIdeaNode({
      id: 'a',
      text: 'A',
      dependsOn: [{ scope: 'daily', dateKey: todayKey, list: 'required', id: 't1' }]
    });
    const ctx = {
      schedule: {
        [todayKey]: {
          required: [{ id: 't1', text: 'T', completed: true }],
          optional: []
        }
      },
      ideas: [node],
      todayKey,
      dayKey: todayKey
    };
    expect(isIdeaReady(node, ctx)).toBe(true);
  });

  it('cross-day daily refs do not block (days are decoupled)', () => {
    const node = createIdeaNode({
      id: 'a',
      text: 'A',
      dependsOn: [{ scope: 'daily', dateKey: '2026-09-16', list: 'required', id: 't1' }]
    });
    const ctx = {
      schedule: {
        '2026-09-16': {
          required: [{ id: 't1', text: 'T', completed: false }],
          optional: []
        }
      },
      ideas: [node],
      todayKey,
      dayKey: todayKey
    };
    expect(isIdeaReady(node, ctx)).toBe(true);
    expect(isRefSatisfied(node.dependsOn[0], ctx)).toBe(true);
  });

  it('missing ref is satisfied', () => {
    const ref = { scope: 'daily', dateKey: '2026-01-01', list: 'required', id: 'gone' };
    expect(isRefSatisfied(ref, { schedule: {}, ideas: [], todayKey, dayKey: todayKey })).toBe(true);
  });

  it('idea predecessor must be completed', () => {
    const a = createIdeaNode({
      id: 'a',
      text: 'A',
      dependsOn: [{ scope: 'idea', id: 'b' }]
    });
    const b = createIdeaNode({ id: 'b', text: 'B', completed: false });
    const ctx = { schedule: {}, ideas: [a, b], todayKey };
    expect(isIdeaReady(a, ctx)).toBe(false);
    b.completed = true;
    expect(isIdeaReady(a, ctx)).toBe(true);
  });

  it('partition separates ready waiting completed', () => {
    const ready = createIdeaNode({ id: 'r', text: 'R' });
    const wait = createIdeaNode({ id: 'w', text: 'W', dueDate: '2099-01-01' });
    const done = createIdeaNode({ id: 'd', text: 'D', completed: true });
    const parts = partitionIdeas([ready, wait, done], {
      schedule: {},
      ideas: [ready, wait, done],
      todayKey
    });
    expect(parts.ready.map((n) => n.id)).toEqual(['r']);
    expect(parts.waiting.map((n) => n.id)).toEqual(['w']);
    expect(parts.completed.map((n) => n.id)).toEqual(['d']);
  });
});
