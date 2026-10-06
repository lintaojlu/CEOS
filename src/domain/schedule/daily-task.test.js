import { describe, it, expect } from 'vitest';
import { createDailyTask, createSubtask, normalizeSubtasks, cloneDailyTask } from './daily-task.js';

describe('createDailyTask', () => {
  it('defaults to an empty subtasks array and zero pomodoros', () => {
    const task = createDailyTask('hello', new Date('2026-09-21'));
    expect(task.subtasks).toEqual([]);
    expect(task.pomodoros).toBe(0);
  });

  it('normalizes provided subtasks', () => {
    const task = createDailyTask('parent', new Date('2026-09-21'), {
      subtasks: [{ id: 's1', text: 'a', completed: true }, null, { text: 'b' }]
    });
    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0]).toEqual({ id: 's1', text: 'a', completed: true });
    expect(task.subtasks[1].text).toBe('b');
    expect(task.subtasks[1].completed).toBe(false);
    expect(task.subtasks[1].id).toBeTruthy();
  });
});

describe('createSubtask / normalizeSubtasks', () => {
  it('createSubtask trims text', () => {
    expect(createSubtask('  x  ')).toMatchObject({ text: 'x', completed: false });
  });

  it('normalizeSubtasks returns [] for non-arrays', () => {
    expect(normalizeSubtasks(null)).toEqual([]);
    expect(normalizeSubtasks(undefined)).toEqual([]);
  });
});

describe('cloneDailyTask', () => {
  it('resets pomodoros to 0 for sync copies', () => {
    const task = createDailyTask('x', new Date('2026-09-21'), { pomodoros: 3 });
    expect(task.pomodoros).toBe(3);
    const cloned = cloneDailyTask(task);
    expect(cloned.pomodoros).toBe(0);
    expect(cloned.id).toBe(task.id);
  });
});
