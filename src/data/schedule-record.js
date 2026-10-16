/**
 * Persisted schedule shape. This module only describes and normalizes stored
 * records. Sync, readiness, and time parsing live in the domain layer.
 */

import { normalizeNotes, normalizeTagIds } from '../domain/schedule/daily-task.js';

/**
 * @typedef {Object} TaskNoteRecord
 * @property {string} id
 * @property {string} text
 */

/**
 * @typedef {Object} DailyTaskRecord
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 * @property {number} time
 * @property {boolean} pinned
 * @property {string} recurrence
 * @property {string[]} tagIds
 * @property {TaskNoteRecord[]} notes
 */

/**
 * @typedef {Object} TaskRefRecord
 * @property {'daily'|'idea'} scope
 * @property {string} [dateKey]
 * @property {'required'|'optional'} [list]
 * @property {string} id
 */

/**
 * A calendar day stores only that day's tasks plus that day's reflection.
 * Ideas and tags live outside the day record.
 * @typedef {Object} ScheduleDayRecord
 * @property {DailyTaskRecord[]} required
 * @property {DailyTaskRecord[]} optional
 * @property {string} reflection
 * @property {string[]} reflectionTags
 */

/** @returns {ScheduleDayRecord} */
export function createEmptyScheduleDay() {
  return {
    required: [],
    optional: [],
    reflection: '',
    reflectionTags: []
  };
}

/**
 * @param {any} raw
 * @returns {DailyTaskRecord[]}
 */
function normalizeTasks(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter((t) => t && t.id)
    .map((t) => ({
      id: String(t.id),
      text: t.text || '',
      completed: !!t.completed,
      time: typeof t.time === 'number' ? t.time : Date.now(),
      pinned: !!t.pinned,
      recurrence: t.recurrence || '',
      tagIds: normalizeTagIds(t),
      notes: normalizeNotes(t.notes, { note: t.note, subtasks: t.subtasks })
    }))
    .filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
}

/**
 * @param {any} raw
 * @returns {ScheduleDayRecord}
 */
export function normalizeScheduleDay(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyScheduleDay();
  const tags = Array.isArray(raw.reflectionTags)
    ? raw.reflectionTags
    : raw.reflectionTag
      ? [raw.reflectionTag]
      : [];
  return {
    required: normalizeTasks(raw.required),
    optional: normalizeTasks(raw.optional),
    reflection: typeof raw.reflection === 'string' ? raw.reflection : '',
    reflectionTags: tags
  };
}
