import { describe, expect, it } from 'vitest';
import {
  adoptTask,
  deleteFromList,
  fallbackGroupTitle,
  nestTasks,
  titleFromModel,
  toggleInList
} from './task-group.js';

function task(id, text, extra = {}) {
  return { id, text, completed: false, time: 1, pinned: false, recurrence: '', tagIds: [], notes: [], ...extra };
}

describe('task groups', () => {
  it('clips the fallback title to 12 characters', () => {
    expect(fallbackGroupTitle(['去超市把菜买齐', '回家把晚饭做完'])).toBe('去超市把菜买齐、回家把晚');
    expect(titleFromModel('```json\n{"title":"晚饭准备好了没有"}\n```')).toBe('晚饭准备好了没有');
    expect(titleFromModel('{"title":"买菜做饭洗碗扫地拖地擦窗再收"}')).toBe('买菜做饭洗碗扫地拖地擦窗');
  });

  it('puts the target first and the dragged task second', () => {
    const nested = nestTasks([task('a', '买菜'), task('b', '做饭'), task('c', '散步')], 'a', 'b');
    expect(nested.tasks.map((item) => item.id)).toEqual([nested.group.id, 'c']);
    expect(nested.group.id).toEqual(expect.any(String));
    expect(nested.group.id.length).toBeGreaterThan(0);
    expect(nested.group.children.map((child) => child.id)).toEqual(['a', 'b']);
    expect(nested.group.notes).toEqual([]);
    expect(nested.group.tagIds).toEqual([]);
    expect(nested.group.text).toBe('买菜、做饭');
  });

  it('appends into an existing box without renaming it', () => {
    const nested = nestTasks([task('a', '买菜'), task('b', '做饭')], 'a', 'b', 'box');
    const adopted = adoptTask([...nested.tasks, task('c', '洗碗')], 'box', 'c');
    expect(adopted.group.text).toBe('买菜、做饭');
    expect(adopted.group.children.map((child) => child.id)).toEqual(['a', 'b', 'c']);
  });

  it('completes every child from the box and dissolves when one remains', () => {
    const nested = nestTasks([task('a', '买菜'), task('b', '做饭')], 'a', 'b', 'box');
    const checked = toggleInList(nested.tasks, 'box');
    expect(checked.tasks[0].completed).toBe(true);
    expect(checked.tasks[0].children.every((child) => child.completed)).toBe(true);
    const oneOff = toggleInList(checked.tasks, 'b');
    expect(oneOff.tasks[0].completed).toBe(false);
    expect(oneOff.tasks[0].children.find((child) => child.id === 'a').completed).toBe(true);
    const released = deleteFromList(nested.tasks, 'box');
    expect(released.map((item) => item.id)).toEqual(['a', 'b']);
    const dissolved = deleteFromList(nested.tasks, 'b');
    expect(dissolved.map((item) => item.id)).toEqual(['a']);
    expect(dissolved[0].children).toBeUndefined();
  });
});
