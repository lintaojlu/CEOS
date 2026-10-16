import { describe, it, expect } from 'vitest';
import { syncPrevDayTasks, syncPrevDay } from './schedule-day.js';
import { createEmptyScheduleDay, normalizeScheduleDay } from '../../data/schedule-record.js';

describe('syncPrevDayTasks', () => {
  it('copies unfinished required/optional only', () => {
    const prev = {
      required: [
        { id: 'r1', text: 'done', completed: true },
        { id: 'r2', text: 'open', completed: false }
      ],
      optional: [{ id: 'o1', text: 'opt', completed: false }],
      reflection: '',
      reflectionTags: []
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
      reflectionTags: []
    };
    const current = {
      ...createEmptyScheduleDay(),
      required: [{ id: 'r1', text: 'already here', completed: false }]
    };
    syncPrevDayTasks(prev, current);
    expect(current.required).toHaveLength(1);
    expect(current.required[0].text).toBe('already here');
  });

  it('deep-copies notes so days do not share references', () => {
    const note = { id: 's1', text: 'step' };
    const prev = {
      ...createEmptyScheduleDay(),
      required: [
        {
          id: 'r1',
          text: 'parent',
          completed: false,
          notes: [note]
        }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.required[0].notes).toEqual([{ id: 's1', text: 'step' }]);
    expect(current.required[0].notes).not.toBe(prev.required[0].notes);
    expect(current.required[0].notes[0]).not.toBe(note);
    current.required[0].notes[0].text = 'changed';
    expect(note.text).toBe('step');
  });

  it('keeps the original task id and tagId', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [
        {
          id: 'r1',
          text: '写计划',
          completed: false,
          tagId: 'p-old',
          subtasks: []
        },
        { id: 'r2', text: 'done', completed: true, tagId: 'p-old' }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.required.map((t) => t.id)).toEqual(['r1']);
    expect(current.required[0].tagIds).toEqual(['p-old']);
    expect(current.required[0]).not.toBe(prev.required[0]);
    expect(current.projects).toBeUndefined();
  });

  it('does not copy the same unfinished task twice', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      optional: [
        { id: 'r1', text: '文章', completed: false, tagIds: [] },
        { id: 'r1', text: '文章', completed: false, tagIds: [] }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDayTasks(prev, current);
    expect(current.optional.map((task) => task.id)).toEqual(['r1']);
  });

  it('fills tags onto an existing copy that lost them', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [{ id: 'r1', text: '开箱即用', completed: false, tagIds: ['ceos'] }]
    };
    const current = {
      ...createEmptyScheduleDay(),
      required: [{ id: 'r1', text: '开箱即用', completed: false, tagIds: [] }]
    };
    syncPrevDayTasks(prev, current);
    expect(current.required).toHaveLength(1);
    expect(current.required[0].tagIds).toEqual(['ceos']);
  });

  it('does not replace tags the current day already has', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [{ id: 'r1', text: '开箱即用', completed: false, tagIds: ['ceos'] }]
    };
    const current = {
      ...createEmptyScheduleDay(),
      required: [{ id: 'r1', text: '开箱即用', completed: false, tagIds: ['life'] }]
    };
    syncPrevDayTasks(prev, current);
    expect(current.required[0].tagIds).toEqual(['life']);
  });

});

describe('syncPrevDay', () => {
  it('copies only unfinished tasks and leaves ideas and projects alone', () => {
    const prev = {
      ...createEmptyScheduleDay(),
      required: [
        { id: 'r1', text: '写计划', completed: false, tagId: 'p-old' },
        { id: 'r2', text: 'done', completed: true, tagId: 'p-old' }
      ]
    };
    const current = createEmptyScheduleDay();
    syncPrevDay(prev, current);
    expect(current.required.map((t) => t.id)).toEqual(['r1']);
    expect(current.required[0].tagIds).toEqual(['p-old']);
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
      projects: [{ id: 'p1', name: 'CEOS', tasks: [] }],
      aiEval: '一份旧日报'
    });
    expect(day.required.map((t) => t.id)).toEqual(['t1']);
    expect(day.ideas).toBeUndefined();
    expect(day.milestones).toBeUndefined();
    expect(day.projects).toBeUndefined();
    expect(day.aiEval).toBeUndefined();
  });

  it('reads a legacy tagId as one entry in tagIds', () => {
    const day = normalizeScheduleDay({
      required: [{ id: 't1', text: 'a', tagId: 'p-old' }]
    });
    expect(day.required[0].tagIds).toEqual(['p-old']);
    expect(day.required[0].tagId).toBeUndefined();
  });
});
