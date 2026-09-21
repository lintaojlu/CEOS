import { describe, it, expect } from 'vitest';
import { ScheduleRepository } from './schedule-repository.js';

describe('ScheduleRepository.ensureDay', () => {
  it('keeps the same ideas array across repeated access', () => {
    const repo = new ScheduleRepository({
      getJson: () => ({}),
      setJson: () => {}
    });
    const data = {};
    const day = repo.ensureDay(data, '2026-09-18');
    day.ideas.push({
      id: 'a',
      text: 'A',
      note: '',
      completed: false,
      pinned: false,
      createdAt: 1,
      dueDate: null,
      dependsOn: [],
      position: null
    });

    const ideas1 = repo.ensureDay(data, '2026-09-18').ideas;
    const ideas2 = repo.ensureDay(data, '2026-09-18').ideas;
    expect(ideas1).toBe(ideas2);

    const target = ideas1[0];
    target.dependsOn = [{ scope: 'idea', id: 'b' }];
    expect(ideas2[0].dependsOn).toEqual([{ scope: 'idea', id: 'b' }]);
  });
});
