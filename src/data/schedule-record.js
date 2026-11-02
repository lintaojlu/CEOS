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
 * @property {DailyTaskRecord[]} [children]
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
/**
 * @param {any} raw
 * @param {Set<string>} seen
 * @param {boolean} allowChildren
 * @returns {DailyTaskRecord | null}
 */
function normalizeOne(raw, seen, allowChildren) {
  if (!raw || !raw.id) return null;
  const id = String(raw.id);
  if (seen.has(id)) return null;
  /** @type {DailyTaskRecord} */
  const task = {
    id,
    text: raw.text || '',
    completed: !!raw.completed,
    time: typeof raw.time === 'number' ? raw.time : Date.now(),
    pinned: !!raw.pinned,
    recurrence: raw.recurrence || '',
    tagIds: normalizeTagIds(raw),
    notes: normalizeNotes(raw.notes, { note: raw.note, subtasks: raw.subtasks })
  };
  if (!allowChildren || !Array.isArray(raw.children)) {
    seen.add(id);
    return task;
  }
  /** @type {DailyTaskRecord[]} */
  const children = [];
  seen.add(id);
  raw.children.forEach((child) => {
    const next = normalizeOne(child, seen, false);
    if (next) children.push(next);
  });
  if (children.length >= 2) {
    task.children = children;
    return task;
  }
  if (children.length === 1) return children[0];
  return null;
}

function normalizeTasks(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  /** @type {DailyTaskRecord[]} */
  const tasks = [];
  raw.forEach((item) => {
    const task = normalizeOne(item, seen, true);
    if (task) tasks.push(task);
  });
  return tasks;
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
