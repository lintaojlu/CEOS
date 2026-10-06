/**
 * Business rules over a stored day. The record shape itself lives in
 * `src/data/schedule-record.js`. Ideas, projects, and milestones are global.
 *
 * @typedef {import('../../data/schedule-record.js').ScheduleDayRecord} ScheduleDay
 */

import { cloneDailyTask } from './daily-task.js';

/**
 * Copy unfinished required/optional from prev into current.
 * Keeps the original task id and projectId. Completed tasks stay on prev.
 * @param {ScheduleDay|null|undefined} prev
 * @param {ScheduleDay} current
 * @returns {ScheduleDay}
 */
export function syncPrevDayTasks(prev, current) {
  if (!prev) return current;
  ['required', 'optional'].forEach((type) => {
    const prevList = prev[type] || [];
    if (!current[type]) current[type] = [];
    const existingIds = new Set(current[type].map((t) => t.id));
    prevList.forEach((t) => {
      if (!t || t.completed || existingIds.has(t.id)) return;
      current[type].push(cloneDailyTask(t));
    });
  });
  return current;
}

/**
 * Copy a source day's unfinished required/optional onto the current day.
 * Ideas, projects, and milestones are not copied.
 * @param {ScheduleDay|null|undefined} prev
 * @param {ScheduleDay} current
 * @returns {ScheduleDay}
 */
export function syncPrevDay(prev, current) {
  return syncPrevDayTasks(prev, current);
}
