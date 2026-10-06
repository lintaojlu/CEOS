import { describe, expect, it } from 'vitest';
import { INSIGHT_DEFS } from './insight-definitions.js';
import { buildInsightSnapshot } from './insight-snapshot.js';

const schedule = {
  '2026-10-04': {
    required: [{ id: 'a', completed: true, projectId: 'p1' }],
    optional: []
  },
  '2026-10-05': {
    required: [{ id: 'b', completed: false, projectId: 'p1' }],
    optional: [{ id: 'c', completed: true, projectId: '' }]
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
      dueDate: '2026-10-03',
      dependsOn: [{ scope: 'daily', dateKey: '2026-10-05', list: 'required', id: 'b' }]
    },
    { id: 'i2', text: '可以做', completed: false, pinned: false, createdAt: Date.parse('2026-10-05T12:00:00'), dueDate: null, dependsOn: [] }
  ],
  projects: [
    {
      id: 'p1',
      name: '垂搜',
      tasks: [
        { id: 'a', completed: true },
        { id: 'b', completed: false }
      ]
    }
  ]
};

describe('buildInsightSnapshot', () => {
  it('summarizes completion, rhythm, projects, and ideas from the same records', () => {
    const snapshot = buildInsightSnapshot({ schedule, workspace, todayKey: '2026-10-05' });
    expect(snapshot.completion.last7.completed).toBe(2);
    expect(snapshot.completion.last7.total).toBe(3);
    expect(snapshot.rhythm.activeDays).toBe(2);
    expect(snapshot.projects.rows[0]).toMatchObject({ name: '垂搜', done: 1, total: 2, stalled: false });
    expect(snapshot.ideas.ready).toBe(1);
    expect(snapshot.ideas.overdueCount).toBe(1);
    expect(snapshot.ideas.averageDwellDays).toBeGreaterThan(0);
  });
});

describe('insight prompts', () => {
  it('embeds the snapshot numbers and exposes four modules', () => {
    const snapshot = buildInsightSnapshot({ schedule, workspace, todayKey: '2026-10-05' });
    expect(INSIGHT_DEFS.map((item) => item.id)).toEqual(['completion', 'rhythm', 'projects', 'ideas']);
    const prompt = INSIGHT_DEFS[0].prompt(snapshot);
    expect(prompt).toContain('近 7 天');
    expect(prompt).toContain('2/3');
    expect(prompt).toContain('不超过 40 个字');
    expect(INSIGHT_DEFS[0].system).toContain('不超过 40 个字');
    expect(INSIGHT_DEFS[2].prompt(snapshot)).toContain('垂搜');
    expect(INSIGHT_DEFS[0].headline(snapshot).caption).toBe('近 7 天完成率');
  });
});
