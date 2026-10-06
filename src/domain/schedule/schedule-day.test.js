import { describe, it, expect } from 'vitest';
import { computeStreakDays, syncPrevDayTasks, syncPrevDay } from './schedule-day.js';
import { createEmptyScheduleDay, normalizeScheduleDay } from '../../data/schedule-record.js';
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
    expect(current.required[0].id).toBe('r1');
    expect(current.ideas).toBeUndefined();
    expect(current.milestones).toBeUndefined();
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

  it('deep-copies subtasks so days do not share references', () => {
    const sub = { id: 's1', text: 'step', completed: false };
    const prev = {
      ...createEmptyScheduleDay(),
      required: [
        {
          id: 'r1',
          text: 'parent',
          completed: false,
          subtasks: [sub]
        }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.required[0].subtasks).toEqual([{ id: 's1', text: 'step', completed: false }]);
    expect(current.required[0].subtasks).not.toBe(prev.required[0].subtasks);
    expect(current.required[0].subtasks[0]).not.toBe(sub);
    current.required[0].subtasks[0].completed = true;
    expect(sub.completed).toBe(false);
  });

  it('keeps the original task id and projectId', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [
        {
          id: 'r1',
          text: '写计划',
          completed: false,
          projectId: 'p-old',
          subtasks: []
        },
        { id: 'r2', text: 'done', completed: true, projectId: 'p-old' }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.required.map((t) => t.id)).toEqual(['r1']);
    expect(current.required[0].projectId).toBe('p-old');
    expect(current.required[0]).not.toBe(prev.required[0]);
    expect(current.projects).toBeUndefined();
  });

  it('resets pomodoros to 0 on sync clone', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [
        {
          id: 'r1',
          text: '专注',
          completed: false,
          pomodoros: 4,
          subtasks: []
        }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.required[0].pomodoros).toBe(0);
    expect(prev.required[0].pomodoros).toBe(4);
  });
});

describe('syncPrevDay', () => {
  it('copies only unfinished tasks and leaves ideas and projects alone', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [
        { id: 'r1', text: '写计划', completed: false, projectId: 'p-old' },
        { id: 'r2', text: 'done', completed: true, projectId: 'p-old' }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDay(prev, current);
    expect(current.required.map((t) => t.id)).toEqual(['r1']);
    expect(current.required[0].projectId).toBe('p-old');
    expect(current.ideas).toBeUndefined();
    expect(current.projects).toBeUndefined();
  });
});

describe('normalizeScheduleDay', () => {
  it('keeps tasks and drops ideas, milestones, and projects', () => {
    const day = normalizeScheduleDay({
      required: [{ id: 't1', text: 'a', completed: false }],
      ideas: [{ id: 'i1', text: 'idea' }],
      milestones: [{ id: 'm1', title: 'm', date: '2026-09-16' }],
      projects: [{ id: 'p1', name: 'CEOS', tasks: [] }]
    });
    expect(day.required.map((t) => t.id)).toEqual(['t1']);
    expect(day.ideas).toBeUndefined();
    expect(day.milestones).toBeUndefined();
    expect(day.projects).toBeUndefined();
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
