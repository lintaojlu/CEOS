/**
 * @typedef {Object} Milestone
 * @property {string} id
 * @property {string} title
 * @property {string} date
 * @property {boolean} completed
 */

/**
 * @param {string} title
 * @param {string} date
 * @returns {Milestone}
 */
export function createMilestone(title, date) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    date,
    completed: false
  };
}

/** @param {Milestone[]} milestones */
export function sortMilestonesByDate(milestones) {
  milestones.sort((a, b) => new Date(a.date) - new Date(b.date));
  return milestones;
}
