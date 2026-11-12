import { describe, expect, it } from 'vitest';
import { projectDay } from '../schedule/schedule-document.js';
import { dayCompletion, requiredCompletion } from './day-completion.js';
import { indexDayStats, indexedCompletion, indexedRequired } from './day-index.js';

function task(id, list, start, due, completed, groupId = '') {
  return { id, list, start, due, completed, groupId, tagIds: [] };
}

describe('indexDayStats', () => {
  it('matches projecting each day, including a group that only partly covers a day', () => {
    const schedule = {
      tasks: [
        task('a', 'required', '2026-10-01', '2026-10-02', true),
        task('b', 'optional', '2026-10-02', '2026-10-02', false),
        task('c1', 'required', '2026-10-01', '2026-10-02', true, 'g'),
        task('c2', 'required', '2026-10-02', '2026-10-02', false, 'g')
      ],
      groups: [{ id: 'g', title: '一组', list: 'required', childIds: ['c1', 'c2'] }],
      order: { required: ['a', 'g'], optional: ['b'] }
    };
    const stats = indexDayStats(schedule);
    ['2026-10-01', '2026-10-02', '2026-10-03'].forEach((dateKey) => {
      const day = projectDay(schedule, dateKey);
      expect(indexedCompletion(stats.get(dateKey))).toEqual(dayCompletion(day));
      expect(indexedRequired(stats.get(dateKey))).toEqual(requiredCompletion(day));
    });
  });
});
