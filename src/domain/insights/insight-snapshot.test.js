import { describe, expect, it } from 'vitest';
import { INSIGHT_DEFS } from './insight-definitions.js';
import { buildInsightSnapshot } from './insight-snapshot.js';

const schedule = {
  '2026-10-04': {
    required: [{ id: 'a', completed: true, tagId: 'p1' }],
    optional: []
  },
  '2026-10-05': {
    required: [{ id: 'b', completed: false, tagId: 'p1' }],
    optional: [{ id: 'c', completed: true, tagId: '' }]
  }
};

const workspace = {
  ideas: [
    {
      id: 'i1',
      text: '等一等',
      completed: false,
      pinned: false,
      createdAt: Date.parse('2026-10-01T12:00:00'),
      dueDate: '2026-10-20'
    },
    { id: 'i2', text: '可以做', completed: false, pinned: false, createdAt: Date.parse('2026-10-05T12:00:00'), dueDate: '2026-10-03' }
  ],
  tags: [
    {
      id: 'p1',
      name: '垂搜',
      color: '#1F9D8A'
    },
    { id: 'empty', name: '空标签', color: '#E56B6F' }
  ]
};

describe('buildInsightSnapshot', () => {
  it('summarizes completion, rhythm, tags, and ideas from the same records', () => {
    const snapshot = buildInsightSnapshot({ schedule, workspace, todayKey: '2026-10-05' });
    expect(snapshot.completion.last7.completed).toBe(2);
    expect(snapshot.completion.last7.total).toBe(3);
    expect(snapshot.rhythm.activeDays).toBe(2);
    expect(snapshot.tags.rows).toHaveLength(1);
    expect(snapshot.tags.rows[0]).toMatchObject({ name: '垂搜', done: 1, total: 2, stalled: false });
    expect(snapshot.ideas.ready).toBe(2);
    expect(snapshot.ideas.waiting).toBe(0);
    expect(snapshot.ideas.overdueCount).toBe(0);
    expect(snapshot.ideas.averageDwellDays).toBeGreaterThan(0);
  });
});

describe('insight sentences', () => {
  it('fills the four modules from the snapshot numbers', () => {
    const snapshot = buildInsightSnapshot({ schedule, workspace, todayKey: '2026-10-05' });
    expect(INSIGHT_DEFS.map((item) => item.id)).toEqual(['completion', 'rhythm', 'tags', 'ideas']);
    expect(INSIGHT_DEFS[0].text(snapshot)).toBe('近 7 天完成 2/3（67%），前 7 天 无数据，近 30 天 67%。');
    expect(INSIGHT_DEFS[0].headline(snapshot).caption).toBe('近 7 天完成率');
    expect(INSIGHT_DEFS[1].text(snapshot)).toContain('活跃 2 天，当前连续');
    expect(INSIGHT_DEFS[2].text(snapshot)).toBe('标签任务完成 1/2。');
    expect(INSIGHT_DEFS[3].text(snapshot)).toContain('共 2 条，未完成 2，已完成 0。');
    expect(INSIGHT_DEFS[3].text(snapshot)).not.toContain('过期');
  });

  it('uses the empty sentences when there is nothing to count', () => {
    const snapshot = buildInsightSnapshot({ schedule: {}, workspace: { ideas: [], tags: [] }, todayKey: '2026-10-05' });
    expect(INSIGHT_DEFS[0].text(snapshot)).toBe('近 7 天没有必做任务。');
    expect(INSIGHT_DEFS[2].text(snapshot)).toBe('还没有标签。');
    expect(INSIGHT_DEFS[3].text(snapshot)).toBe('共 0 条，未完成 0，已完成 0。');
  });
});
