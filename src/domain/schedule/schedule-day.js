/**
 * Business rules over a stored day. The record shape itself lives in
 * `src/data/schedule-record.js`. Ideas and tags are global.
 *
 * @typedef {import('../../data/schedule-record.js').ScheduleDayRecord} ScheduleDay
 */

import { cloneDailyTask, normalizeTagIds } from './daily-task.js';

/**
 * @param {any[] | null | undefined} list
 */
function indexTaskIds(list) {
  const existing = new Map();
  (list || []).forEach((task) => {
    if (task?.id && !existing.has(task.id)) existing.set(task.id, task);
    (task?.children || []).forEach((child) => {
      if (child?.id && !existing.has(child.id)) existing.set(child.id, child);
    });
  });
  return existing;
}

/**
 * Copy unfinished required/optional from prev into current.
 * Keeps the original task id and tagIds. Completed tasks stay on prev.
 * @param {ScheduleDay|null|undefined} prev
 * @param {ScheduleDay} current
 * @returns {ScheduleDay}
 */
export function syncPrevDayTasks(prev, current) {
  if (!prev) return current;
  ['required', 'optional'].forEach((type) => {
    const prevList = prev[type] || [];
    if (!current[type]) current[type] = [];
    const existing = indexTaskIds(current[type]);
    const seen = new Set();
    prevList.forEach((task) => {
      if (!task?.id || seen.has(task.id)) return;
      seen.add(task.id);
      const kids = Array.isArray(task.children) ? task.children.filter((child) => child && child.id) : null;
      if (kids && kids.length) {
        if (existing.has(task.id)) return;
        const pending = kids.filter((child) => !child.completed && !existing.has(child.id) && !seen.has(child.id));
        pending.forEach((child) => seen.add(child.id));
        if (pending.length >= 2) {
          const copy = cloneDailyTask(task);
          copy.children = pending.map((child) => cloneDailyTask(child));
          copy.completed = copy.children.every((child) => child.completed);
          copy.tagIds = [];
          copy.notes = [];
          current[type].push(copy);
          existing.set(copy.id, copy);
          copy.children.forEach((child) => existing.set(child.id, child));
        } else if (pending.length === 1) {
          const copy = cloneDailyTask(pending[0]);
          current[type].push(copy);
          existing.set(copy.id, copy);
        }
        return;
      }
      if (task.completed) return;
      const tags = normalizeTagIds(task);
      const found = existing.get(task.id);
      if (found) {
        if (normalizeTagIds(found).length === 0 && tags.length > 0) {
          found.tagIds = tags;
          delete found.tagId;
        }
        return;
      }
      const copy = cloneDailyTask(task);
      current[type].push(copy);
      existing.set(task.id, copy);
    });
  });
  return current;
}

/**
 * Copy a source day's unfinished required/optional onto the current day.
 * Ideas and tags are not copied. Old milestone fields on a day are dropped.
 * @param {ScheduleDay|null|undefined} prev
 * @param {ScheduleDay} current
 * @returns {ScheduleDay}
 */
export function syncPrevDay(prev, current) {
  return syncPrevDayTasks(prev, current);
}
