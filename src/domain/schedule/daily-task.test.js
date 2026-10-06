import { describe, it, expect } from 'vitest';
import { createDailyTask, createSubtask, normalizeSubtasks, splitTimeMentions } from './daily-task.js';

describe('createDailyTask', () => {
  it('defaults to an empty subtasks array', () => {
    const task = createDailyTask('hello', new Date('2026-09-21'));
    expect(task.subtasks).toEqual([]);
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

describe('splitTimeMentions', () => {
  it('keeps a mentioned time in place so the task text follows it', () => {
    expect(splitTimeMentions('15:00 和客户开会')).toEqual([
      { text: '15:00', time: true },
      { text: ' 和客户开会', time: false }
    ]);
    expect(splitTimeMentions('下午3点和客户开会').map((part) => part.text).join('')).toBe('下午3点和客户开会');
    expect(splitTimeMentions('下午3点和客户开会').filter((part) => part.time).map((part) => part.text)).toEqual(['下午3点']);
    expect(splitTimeMentions('写方案')).toEqual([{ text: '写方案', time: false }]);
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
