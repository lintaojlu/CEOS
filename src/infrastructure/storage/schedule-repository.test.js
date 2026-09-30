import { describe, it, expect } from 'vitest';
import { ScheduleRepository } from './schedule-repository.js';

describe('ScheduleRepository.ensureDay', () => {
  it('returns the same day object across repeated access', () => {
    const repo = new ScheduleRepository({
      getJson: () => ({}),
      setJson: () => {}
    });
    const data = {};
    const day = repo.ensureDay(data, '2026-09-18');
    day.required.push({ id: 'a', text: 'A', completed: false });
    const again = repo.ensureDay(data, '2026-09-18');
    expect(again).toBe(day);
    expect(again.required[0].id).toBe('a');
  });
});
