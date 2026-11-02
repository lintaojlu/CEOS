import { cloneDailyTask, createDailyTask } from './daily-task.js';

export const GROUP_TITLE_LIMIT = 12;

/** 合并两条任务时发给小模型的说明。只收一段 JSON。 */
export const GROUP_TITLE_SYSTEM = '只输出 JSON：{"title":"<标题>"}。不解释、不询问，不返回除了 JSON 外任何内容。根据两条任务标题生成一个总标题，不超过 12 个字。';

/**
 * @param {string[]} titles
 * @returns {string}
 */
export function buildGroupTitlePrompt(titles) {
  return (titles || []).map((title) => String(title || '').trim()).filter(Boolean).join('\n');
}

/** @param {any} task */
export function isGroup(task) {
  return Array.isArray(task?.children) && task.children.length >= 2;
}

/** @param {string} text */
export function clipGroupTitle(text) {
  return Array.from(String(text || '').replace(/\s+/g, ' ').trim()).slice(0, GROUP_TITLE_LIMIT).join('');
}

/** @param {string[]} titles */
export function fallbackGroupTitle(titles) {
  return clipGroupTitle((titles || []).map((title) => String(title || '').trim()).filter(Boolean).join('、'));
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function titleFromModel(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.title === 'string') return clipGroupTitle(parsed.title);
  } catch {
    // 模型没按 JSON 回时，用整段文字。
  }
  const line = body.replace(/^["']|["']$/g, '').split('\n')[0];
  return clipGroupTitle(line);
}

/** @param {any[]} children */
function withCompleted(group, children) {
  return {
    ...group,
    children,
    completed: children.length > 0 && children.every((child) => child.completed)
  };
}

/** @param {any[]} list */
function dissolveAt(list, index) {
  const group = list[index];
  const children = group.children || [];
  if (children.length >= 2) {
    list[index] = withCompleted(group, children);
    return;
  }
  if (children.length === 1) {
    list[index] = children[0];
    return;
  }
  list.splice(index, 1);
}

/**
 * @param {any[]} list
 * @param {string} id
 * @returns {{ task: any, index: number, parent: any | null, childIndex: number } | null}
 */
export function locateTask(list, id) {
  const tasks = list || [];
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (task?.id === id) return { task, index, parent: null, childIndex: -1 };
    const children = task?.children || [];
    const childIndex = children.findIndex((child) => child?.id === id);
    if (childIndex !== -1) {
      return { task: children[childIndex], index, parent: task, childIndex };
    }
  }
  return null;
}

/**
 * @param {any[]} list
 * @param {string} targetId
 * @param {string} draggedId
 * @param {string} [groupId]
 * @returns {{ tasks: any[], group: any } | null}
 */
export function nestTasks(list, targetId, draggedId, groupId) {
  if (!targetId || !draggedId || targetId === draggedId) return null;
  const target = locateTask(list, targetId);
  const dragged = locateTask(list, draggedId);
  if (!target || !dragged) return null;
  if (isGroup(target.task) || isGroup(dragged.task)) return null;
  if (target.parent || dragged.parent) return null;
  const targetTask = cloneDailyTask(target.task);
  const draggedTask = cloneDailyTask(dragged.task);
  const children = [targetTask, draggedTask];
  const group = createDailyTask(
    fallbackGroupTitle([targetTask.text, draggedTask.text]),
    new Date(targetTask.time || Date.now()),
    {
      id: groupId,
      completed: children.every((child) => child.completed),
      time: targetTask.time || Date.now(),
      pinned: false,
      recurrence: '',
      tagIds: [],
      notes: [],
      children
    }
  );
  const next = list.slice();
  next.splice(dragged.index, 1);
  const targetIndex = next.findIndex((task) => task.id === targetId);
  if (targetIndex === -1) return null;
  next.splice(targetIndex, 1, group);
  return { tasks: next, group };
}

/**
 * @param {any[]} list
 * @param {string} groupId
 * @param {string} draggedId
 * @returns {{ tasks: any[], group: any } | null}
 */
export function adoptTask(list, groupId, draggedId) {
  if (!groupId || !draggedId || groupId === draggedId) return null;
  const groupLoc = locateTask(list, groupId);
  const dragged = locateTask(list, draggedId);
  if (!groupLoc || !dragged || !isGroup(groupLoc.task) || groupLoc.parent) return null;
  if (isGroup(dragged.task) || dragged.parent) return null;
  const next = list.slice();
  const task = cloneDailyTask(dragged.task);
  next.splice(dragged.index, 1);
  const index = next.findIndex((item) => item.id === groupId);
  if (index === -1) return null;
  const children = [...(next[index].children || []), task];
  const group = withCompleted(next[index], children);
  next[index] = group;
  return { tasks: next, group };
}

/**
 * @param {any[]} list
 * @param {string} id
 * @returns {{ tasks: any[], task: any } | null}
 */
export function takeTask(list, id) {
  const found = locateTask(list, id);
  if (!found) return null;
  const next = list.slice();
  if (!found.parent) {
    const [task] = next.splice(found.index, 1);
    return { tasks: next, task };
  }
  const group = { ...found.parent, children: found.parent.children.slice() };
  const [task] = group.children.splice(found.childIndex, 1);
  next[found.index] = group;
  dissolveAt(next, found.index);
  return { tasks: next, task };
}

/**
 * @param {any[]} list
 * @param {any} task
 * @param {string} [beforeId]
 */
export function insertTask(list, task, beforeId) {
  const next = list.slice();
  if (beforeId) {
    const top = next.findIndex((item) => item.id === beforeId);
    if (top !== -1) {
      next.splice(top, 0, task);
      return next;
    }
    for (let index = 0; index < next.length; index += 1) {
      const group = next[index];
      if (!isGroup(group)) continue;
      const childIndex = group.children.findIndex((child) => child.id === beforeId);
      if (childIndex === -1) continue;
      const children = group.children.slice();
      children.splice(childIndex, 0, task);
      next[index] = withCompleted(group, children);
      return next;
    }
  }
  next.push(task);
  return next;
}

/**
 * @param {any[]} list
 * @param {string} id
 * @returns {any[] | null}
 */
export function deleteFromList(list, id) {
  const found = locateTask(list, id);
  if (!found) return null;
  const next = list.slice();
  if (!found.parent) {
    if (isGroup(found.task)) next.splice(found.index, 1, ...found.task.children);
    else next.splice(found.index, 1);
    return next;
  }
  const children = found.parent.children.filter((child) => child.id !== id);
  next[found.index] = { ...found.parent, children };
  dissolveAt(next, found.index);
  return next;
}

/**
 * @param {any[]} list
 * @param {string} id
 * @returns {{ tasks: any[], completedIds: string[] } | null}
 */
export function toggleInList(list, id) {
  const found = locateTask(list, id);
  if (!found) return null;
  const next = list.slice();
  /** @type {string[]} */
  const completedIds = [];
  if (!found.parent && isGroup(found.task)) {
    const completed = !found.task.children.every((child) => child.completed);
    const children = found.task.children.map((child) => {
      if (completed && !child.completed) completedIds.push(child.id);
      return { ...child, completed };
    });
    next[found.index] = withCompleted(found.task, children);
    if (completed) completedIds.push(found.task.id);
    return { tasks: next, completedIds };
  }
  if (!found.parent) {
    const completed = !found.task.completed;
    next[found.index] = { ...found.task, completed };
    if (completed) completedIds.push(found.task.id);
    return { tasks: next, completedIds };
  }
  const children = found.parent.children.map((child) => {
    if (child.id !== id) return child;
    const completed = !child.completed;
    if (completed) completedIds.push(child.id);
    return { ...child, completed };
  });
  next[found.index] = withCompleted(found.parent, children);
  return { tasks: next, completedIds };
}

/** @param {any[]} list */
export function leafTasks(list) {
  /** @type {any[]} */
  const leaves = [];
  for (const task of list || []) {
    if (isGroup(task)) leaves.push(...task.children);
    else if (task) leaves.push(task);
  }
  return leaves;
}

/**
 * @param {any[]} list
 * @param {string} id
 * @returns {{ tasks: any[], completedIds: string[], task: any } | null}
 */
export function completeInList(list, id) {
  const found = locateTask(list, id);
  if (!found) return null;
  if (!found.parent && isGroup(found.task)) {
    if (found.task.children.every((child) => child.completed)) {
      return { tasks: list, completedIds: [], task: found.task };
    }
    /** @type {string[]} */
    const completedIds = [];
    const children = found.task.children.map((child) => {
      if (!child.completed) completedIds.push(child.id);
      return { ...child, completed: true };
    });
    const next = list.slice();
    const group = withCompleted(found.task, children);
    next[found.index] = group;
    completedIds.push(group.id);
    return { tasks: next, completedIds, task: group };
  }
  if (found.task.completed) return { tasks: list, completedIds: [], task: found.task };
  const toggled = toggleInList(list, id);
  if (!toggled) return null;
  return { ...toggled, task: locateTask(toggled.tasks, id)?.task || found.task };
}

/**
 * 同一框里调整子任务顺序，不拆框。
 * @param {any} parent
 * @param {string} id
 * @param {string|null} beforeId
 */
export function reorderChild(parent, id, beforeId) {
  const children = (parent.children || []).slice();
  const from = children.findIndex((child) => child.id === id);
  if (from === -1) return false;
  const [item] = children.splice(from, 1);
  let at = children.length;
  if (beforeId) {
    const index = children.findIndex((child) => child.id === beforeId);
    if (index !== -1) at = index;
  }
  if (at === from) {
    children.splice(from, 0, item);
    return false;
  }
  children.splice(at, 0, item);
  parent.children = children;
  parent.completed = children.every((child) => child.completed);
  return true;
}

/**
 * @param {any[]} list
 * @param {string} text
 * @param {string} fallback
 * @returns {any[] | null}
 */
export function renameGroupIfFallback(list, groupId, text, fallback) {
  const found = locateTask(list, groupId);
  if (!found || found.parent || !isGroup(found.task)) return null;
  if ((found.task.text || '') !== fallback) return null;
  const title = clipGroupTitle(text);
  if (!title) return null;
  const next = list.slice();
  next[found.index] = { ...found.task, text: title };
  return next;
}
