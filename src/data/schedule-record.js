/**
 * Persisted schedule shape. This module only describes and normalizes stored
 * records. Sync, readiness, and time parsing live in the domain layer.
 */

/**
 * @typedef {Object} SubtaskRecord
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 */

/**
 * @typedef {Object} DailyTaskRecord
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 * @property {number} time
 * @property {boolean} pinned
 * @property {string} note
 * @property {string} recurrence
 * @property {string} projectId
 * @property {SubtaskRecord[]} subtasks
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
 * Ideas, projects, and milestones live on WorkspaceRecord.
 * @typedef {Object} ScheduleDayRecord
 * @property {DailyTaskRecord[]} required
 * @property {DailyTaskRecord[]} optional
 * @property {string} reflection
 * @property {string[]} reflectionTags
 * @property {string} aiEval
 */

/** @returns {ScheduleDayRecord} */
export function createEmptyScheduleDay() {
  return {
    required: [],
    optional: [],
    reflection: '',
    reflectionTags: [],
    aiEval: ''
  };
}

/**
 * @param {any} raw
 * @returns {SubtaskRecord[]}
 */
function normalizeSubtasks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && (s.id || s.text))
    .map((s) => ({
      id: s.id ? String(s.id) : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(s.text || '').trim(),
      completed: !!s.completed
    }));
}

/**
 * @param {any} raw
 * @returns {DailyTaskRecord[]}
 */
function normalizeTasks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && t.id)
    .map((t) => ({
      id: String(t.id),
      text: t.text || '',
      completed: !!t.completed,
      time: typeof t.time === 'number' ? t.time : Date.now(),
      pinned: !!t.pinned,
      note: t.note || '',
      recurrence: t.recurrence || '',
      projectId: typeof t.projectId === 'string' ? t.projectId : '',
      subtasks: normalizeSubtasks(t.subtasks)
    }));
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
    reflectionTags: tags,
    aiEval: typeof raw.aiEval === 'string' ? raw.aiEval : ''
  };
}
