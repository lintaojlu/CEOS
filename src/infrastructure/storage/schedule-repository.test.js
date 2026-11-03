import { describe, it, expect } from 'vitest';
import { ScheduleRepository } from './schedule-repository.js';

describe('ScheduleRepository', () => {
  it('loads a day map as one global task list', () => {
    const repo = new ScheduleRepository({
      getJson: () => ({
        '2026-09-18': {
          required: [{ id: 'a', text: 'A', completed: false, time: Date.parse('2026-09-18T09:30:00') }],
          optional: [],
          reflection: '丢掉'
        }
      }),
      setJson: () => {}
    });
    const doc = repo.load();
    expect(doc.tasks).toHaveLength(1);
    expect(doc.tasks[0].id).toBe('a');
    expect(doc.tasks[0].start).toBe('2026-09-18');
    expect(doc.tasks[0].due).toBe('2026-09-18');
    expect(doc.tasks[0].minutes).toBe(9 * 60 + 30);
    expect(doc.order.required).toEqual(['a']);
    expect(JSON.stringify(doc)).not.toContain('丢掉');
  });
});
