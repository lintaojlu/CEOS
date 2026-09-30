/**
 * @typedef {Object} Subtask
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 */

/**
 * @typedef {Object} DailyTask
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 * @property {number} time
 * @property {boolean} pinned
 * @property {string} note
 * @property {string} recurrence
 * @property {string} projectId
 * @property {Subtask[]} subtasks
 */

/**
 * @param {string} text
 * @returns {{ hours: number, minutes: number } | null}
 */
export function parseTime(text) {
  const timePatterns = [
    /(\d{1,2}):(\d{2})/,
    /(\d{1,2})点/,
    /(\d{1,2})\s*(am|pm)/i
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hours = parseInt(match[1], 10);
      let minutes = match[2] && !isNaN(parseInt(match[2], 10)) ? parseInt(match[2], 10) : 0;

      if (match[3]) {
        const period = match[3].toLowerCase();
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
      }

      return { hours, minutes };
    }
  }
  return null;
}

/**
 * @param {string} text
 * @param {Partial<Subtask>} [overrides]
 * @returns {Subtask}
 */
export function createSubtask(text, overrides = {}) {
  return {
    id: overrides.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: String(text || '').trim(),
    completed: !!overrides.completed
  };
}

/**
 * @param {any} raw
 * @returns {Subtask[]}
 */
export function normalizeSubtasks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && (s.id || s.text))
    .map((s) =>
      createSubtask(s.text || '', {
        id: s.id,
        completed: !!s.completed
      })
    );
}

/**
 * @param {string} text
 * @param {Date} baseDate
 * @param {Partial<DailyTask>} [overrides]
 * @returns {DailyTask}
 */
export function createDailyTask(text, baseDate, overrides = {}) {
  const timeMatch = parseTime(text);
  let time;
  if (timeMatch) {
    const now = new Date(baseDate);
    now.setHours(timeMatch.hours, timeMatch.minutes, 0, 0);
    time = now.getTime();
  } else {
    time = Date.now();
  }

  const { subtasks: rawSubtasks, ...rest } = overrides;
  return {
    id: rest.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    completed: false,
    time,
    pinned: false,
    note: '',
    recurrence: '',
    ...rest,
    projectId: typeof rest.projectId === 'string' ? rest.projectId : '',
    subtasks: normalizeSubtasks(rawSubtasks)
  };
}

/**
 * Shallow-clone a task including a deep copy of subtasks (for sync).
 * @param {DailyTask|any} task
 * @returns {DailyTask}
 */
export function cloneDailyTask(task) {
  return {
    ...task,
    projectId: typeof task?.projectId === 'string' ? task.projectId : '',
    subtasks: normalizeSubtasks(task?.subtasks).map((s) => ({ ...s }))
  };
}

/** @param {DailyTask[]} tasks */
export function sortTasks(tasks) {
  tasks.sort((a, b) => {
    if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return a.time - b.time;
  });
  return tasks;
}
