import { describe, it, expect } from 'vitest';
import { computeStreakDays, syncPrevDayTasks, syncPrevDayIdeas, createEmptyScheduleDay } from './schedule-day.js';
import { getDateKey, addDays } from '../shared/date-key.js';

describe('syncPrevDayTasks', () => {
  it('copies unfinished required/optional only', () => {
    const prev = {
      required: [
        { id: 'r1', text: 'done', completed: true },
        { id: 'r2', text: 'open', completed: false }
      ],
      optional: [{ id: 'o1', text: 'opt', completed: false }],
      reflection: '',
      reflectionTags: [],
      aiEval: ''
    };
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.required.map((t) => t.id)).toEqual(['r2']);
    expect(current.optional.map((t) => t.id)).toEqual(['o1']);
  });

  it('never copies ideas or milestones', () => {
    const prev = /** @type {any} */ ({
      required: [{ id: 'r1', text: 'a', completed: false }],
      optional: [],
      ideas: [{ id: 'i1', text: 'day-scoped', completed: false }],
      milestones: [{ id: 'm1', title: 'x', date: '2026-09-16', completed: false }]
    });
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.required).toHaveLength(1);
    expect(current.ideas).toEqual([]);
    expect(current.milestones).toEqual([]);
  });

  it('skips ids already present on the current day', () => {
    const prev = {
      required: [{ id: 'r1', text: 'a', completed: false }],
      optional: [],
      reflection: '',
      reflectionTags: [],
      aiEval: ''
    };
    const current = {
      ...createEmptyScheduleDay(),
      required: [{ id: 'r1', text: 'already here', completed: false }]
    };
    syncPrevDayTasks(prev, current);
    expect(current.required).toHaveLength(1);
    expect(current.required[0].text).toBe('already here');
  });
});

describe('syncPrevDayIdeas', () => {
  it('copies unfinished ideas and drops deps pointing at unsynced ideas', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      ideas: [
        { id: 'i1', text: 'done', completed: true },
        { id: 'i2', text: 'open', completed: false, note: 'n', dependsOn: [{ scope: 'idea', id: 'i1' }] }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDayIdeas(prev, current, { prevKey: '2026-09-16', currentKey: '2026-09-17' });
    expect(current.ideas.map((n) => n.id)).toEqual(['i2']);
    expect(current.ideas[0].note).toBe('n');
    // i1 was completed and not copied — dangling cross-day idea dep is dropped
    expect(current.ideas[0].dependsOn).toEqual([]);
  });

  it('keeps idea deps when both ideas sync, remaps daily deps to current day', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [{ id: 't1', text: 'task', completed: false }],
      ideas: [
        { id: 'a', text: 'A', completed: false, dependsOn: [] },
        {
          id: 'b',
          text: 'B',
          completed: false,
          dependsOn: [
            { scope: 'idea', id: 'a' },
            { scope: 'daily', dateKey: '2026-09-16', list: 'required', id: 't1' }
          ]
        }
      ]
    };
    const current = {
      ...createEmptyScheduleDay(),
      required: [{ id: 't1', text: 'task', completed: false }]
    };
    syncPrevDayIdeas(prev, current, { prevKey: '2026-09-16', currentKey: '2026-09-17' });
    const b = current.ideas.find((n) => n.id === 'b');
    expect(b.dependsOn).toEqual([
      { scope: 'idea', id: 'a' },
      { scope: 'daily', dateKey: '2026-09-17', list: 'required', id: 't1' }
    ]);
  });

  it('skips ids already on the current day and never touches milestones', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      ideas: [{ id: 'i1', text: 'open', completed: false }],
      milestones: [{ id: 'm1', title: 'x', date: '2026-09-16', completed: false }]
    };
    const current = {
      ...createEmptyScheduleDay(),
      ideas: [{ id: 'i1', text: 'already', completed: false }]
    };
    syncPrevDayIdeas(prev, current, { prevKey: '2026-09-16', currentKey: '2026-09-17' });
    expect(current.ideas).toHaveLength(1);
    expect(current.ideas[0].text).toBe('already');
    expect(current.milestones).toEqual([]);
  });
});

describe('computeStreakDays', () => {
  const dayWithTask = () => ({ required: [{ id: '1', text: 'x' }], optional: [] });
  const emptyDay = () => ({ required: [], optional: [] });
  const keyFor = (offset) => getDateKey(addDays(new Date(), offset));

  it('counts consecutive days ending today', () => {
    const schedule = {
      [keyFor(0)]: dayWithTask(),
      [keyFor(-1)]: dayWithTask(),
      [keyFor(-2)]: dayWithTask()
    };
    expect(computeStreakDays(schedule, getDateKey)).toBe(3);
  });

  it('breaks the chain on a day without tasks', () => {
    const schedule = {
      [keyFor(0)]: dayWithTask(),
      [keyFor(-1)]: emptyDay(),
      [keyFor(-2)]: dayWithTask()
    };
    expect(computeStreakDays(schedule, getDateKey)).toBe(1);
  });

  it('counts optional-only days', () => {
    const schedule = { [keyFor(0)]: { required: [], optional: [{ id: '1', text: 'x' }] } };
    expect(computeStreakDays(schedule, getDateKey)).toBe(1);
  });

  it('is zero when today has no tasks', () => {
    expect(computeStreakDays({ [keyFor(-1)]: dayWithTask() }, getDateKey)).toBe(0);
  });
});
