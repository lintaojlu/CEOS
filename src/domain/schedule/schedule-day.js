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
 * Copy yesterday's unfinished required/optional onto the current day.
 * Ideas, projects, and milestones are not copied.
 * @param {ScheduleDay|null|undefined} prev
 * @param {ScheduleDay} current
 * @returns {ScheduleDay}
 */
export function syncPrevDay(prev, current) {
  return syncPrevDayTasks(prev, current);
}

/**
 * Consecutive days with daily tasks, counting back from today.
 * Ideas do not extend the streak.
 * @param {Record<string, ScheduleDay>} schedule
 * @param {(d: Date) => string} getDateKeyFn
 * @returns {number}
 */
export function computeStreakDays(schedule, getDateKeyFn) {
  let d = new Date();
  let count = 0;
  for (let i = 0; i < 365; i++) {
    const dayData = schedule[getDateKeyFn(d)];
    const hasTasks =
      dayData &&
      ((dayData.required && dayData.required.length > 0) ||
        (dayData.optional && dayData.optional.length > 0));
    if (!hasTasks) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
