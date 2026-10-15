/**
 * Business rules over a stored day. The record shape itself lives in
 * `src/data/schedule-record.js`. Ideas, tags, and milestones are global.
 *
 * @typedef {import('../../data/schedule-record.js').ScheduleDayRecord} ScheduleDay
 */

import { cloneDailyTask, normalizeTagIds } from './daily-task.js';

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
    const existing = new Map();
    current[type].forEach((task) => {
      if (task?.id && !existing.has(task.id)) existing.set(task.id, task);
    });
    const seen = new Set();
    prevList.forEach((task) => {
      if (!task?.id || task.completed || seen.has(task.id)) return;
      seen.add(task.id);
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
 * Ideas, tags, and milestones are not copied.
 * @param {ScheduleDay|null|undefined} prev
 * @param {ScheduleDay} current
 * @returns {ScheduleDay}
 */
export function syncPrevDay(prev, current) {
  return syncPrevDayTasks(prev, current);
}
