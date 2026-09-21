/**
 * @typedef {'daily'|'idea'} TaskRefScope
 */

/**
 * @typedef {Object} TaskRef
 * @property {TaskRefScope} scope
 * @property {string} [dateKey] - same-day key when scope === 'daily' (days are decoupled)
 * @property {'required'|'optional'} [list] - required when scope === 'daily'
 * @property {string} id
 */

/**
 * @typedef {{ x: number, y: number }} IdeaPosition
 */

/**
 * @typedef {Object} IdeaNode
 * @property {string} id
 * @property {string} text
 * @property {string} note
 * @property {number} createdAt
 * @property {string|null} dueDate - YYYY-MM-DD
 * @property {TaskRef[]} dependsOn
 * @property {boolean} completed
 * @property {boolean} pinned
 * @property {IdeaPosition|null} [position]
 */

/**
 * @param {Partial<IdeaNode> & { text: string }} input
 * @returns {IdeaNode}
 */
export function createIdeaNode(input) {
  let position = null;
  if (
    input.position &&
    typeof input.position.x === 'number' &&
    typeof input.position.y === 'number' &&
    !Number.isNaN(input.position.x) &&
    !Number.isNaN(input.position.y)
  ) {
    position = { x: input.position.x, y: input.position.y };
  }

  return {
    id: input.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: input.text,
    note: input.note || '',
    createdAt: input.createdAt || Date.now(),
    dueDate: input.dueDate ?? null,
    dependsOn: Array.isArray(input.dependsOn) ? input.dependsOn : [],
    completed: !!input.completed,
    pinned: !!input.pinned,
    position
  };
}

/**
 * @param {TaskRef} a
 * @param {TaskRef} b
 * @returns {boolean}
 */
export function taskRefEquals(a, b) {
  if (!a || !b || a.scope !== b.scope || a.id !== b.id) return false;
  if (a.scope === 'idea') return true;
  return a.dateKey === b.dateKey && a.list === b.list;
}

/**
 * @param {TaskRef} ref
 * @returns {string}
 */
export function taskRefKey(ref) {
  if (ref.scope === 'idea') return `idea:${ref.id}`;
  return `daily:${ref.dateKey}:${ref.list}:${ref.id}`;
}
