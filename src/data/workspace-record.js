/**
 * Global workspace: one ideas inbox, one milestone list, one project list.
 * Daily tasks stay on ScheduleDayRecord and are linked to project tasks by id.
 */

/**
 * @typedef {import('./schedule-record.js').SubtaskRecord} SubtaskRecord
 * @typedef {import('./schedule-record.js').TaskRefRecord} TaskRefRecord
 */

/**
 * @typedef {Object} IdeaRecord
 * @property {string} id
 * @property {string} text
 * @property {string} note
 * @property {number} createdAt
 * @property {string|null} dueDate
 * @property {TaskRefRecord[]} dependsOn
 * @property {boolean} completed
 * @property {boolean} pinned
 * @property {{ x: number, y: number }|null} position
 */

/**
 * @typedef {Object} MilestoneRecord
 * @property {string} id
 * @property {string} title
 * @property {string} date
 * @property {boolean} completed
 */

/**
 * Project-side copy of a task. Shares `id` with the daily copy.
 * @typedef {Object} ProjectTaskRecord
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 * @property {string} note
 * @property {number} time
 * @property {boolean} pinned
 * @property {string} recurrence
 * @property {SubtaskRecord[]} subtasks
 * @property {'required'|'optional'} list
 */

/**
 * @typedef {Object} ProjectRecord
 * @property {string} id
 * @property {string} name
 * @property {ProjectTaskRecord[]} tasks
 */

/**
 * @typedef {Object} WorkspaceRecord
 * @property {IdeaRecord[]} ideas
 * @property {MilestoneRecord[]} milestones
 * @property {ProjectRecord[]} projects
 */

/** @returns {WorkspaceRecord} */
export function createEmptyWorkspace() {
  return { ideas: [], milestones: [], projects: [] };
}

/**
 * @param {any} raw
 * @returns {{ x: number, y: number }|null}
 */
function normalizePosition(raw) {
  if (
    raw &&
    typeof raw.x === 'number' &&
    typeof raw.y === 'number' &&
    !Number.isNaN(raw.x) &&
    !Number.isNaN(raw.y)
  ) {
    return { x: raw.x, y: raw.y };
  }
  return null;
}

/**
 * @param {any} raw
 * @returns {import('./schedule-record.js').SubtaskRecord[]}
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
 * @returns {IdeaRecord[]}
 */
export function normalizeIdeas(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && (t.id || t.text))
    .map((t) => ({
      id: t.id ? String(t.id) : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: t.text || '',
      note: t.note || '',
      completed: !!t.completed,
      pinned: !!t.pinned,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : typeof t.time === 'number' ? t.time : Date.now(),
      dueDate: t.dueDate ?? null,
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map((r) => ({ ...r })) : [],
      position: normalizePosition(t.position)
    }));
}

/**
 * @param {any} raw
 * @returns {MilestoneRecord[]}
 */
export function normalizeMilestones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && m.id && (m.title || m.date))
    .map((m) => ({
      id: String(m.id),
      title: String(m.title || ''),
      date: String(m.date || ''),
      completed: !!m.completed
    }));
}

/**
 * @param {any} raw
 * @param {'required'|'optional'} [fallbackList]
 * @returns {ProjectTaskRecord|null}
 */
export function normalizeProjectTask(raw, fallbackList = 'required') {
  if (!raw || !raw.id) return null;
  const list = raw.list === 'optional' ? 'optional' : raw.list === 'required' ? 'required' : fallbackList;
  return {
    id: String(raw.id),
    text: raw.text || '',
    completed: !!raw.completed,
    note: raw.note || '',
    time: typeof raw.time === 'number' ? raw.time : Date.now(),
    pinned: !!raw.pinned,
    recurrence: raw.recurrence || '',
    subtasks: normalizeSubtasks(raw.subtasks),
    list
  };
}

/**
 * @param {any} raw
 * @returns {ProjectRecord[]}
 */
export function normalizeProjects(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && p.id && String(p.name || '').trim())
    .map((p) => ({
      id: String(p.id),
      name: String(p.name).trim(),
      tasks: (Array.isArray(p.tasks) ? p.tasks : [])
        .map((t) => normalizeProjectTask(t))
        .filter(Boolean)
    }));
}

/**
 * @param {any} raw
 * @returns {WorkspaceRecord}
 */
export function normalizeWorkspace(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyWorkspace();
  return {
    ideas: normalizeIdeas(raw.ideas),
    milestones: normalizeMilestones(raw.milestones),
    projects: normalizeProjects(raw.projects)
  };
}
