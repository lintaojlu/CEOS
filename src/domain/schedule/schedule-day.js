/**
 * @typedef {Object} ScheduleDay
 * @property {import('./daily-task.js').DailyTask[]} required
 * @property {import('./daily-task.js').DailyTask[]} optional
 * @property {import('../ideas/idea-node.js').IdeaNode[]} ideas
 * @property {import('../milestone/milestone.js').Milestone[]} milestones
 * @property {string} reflection
 * @property {string[]} reflectionTags
 * @property {string} aiEval
 */

import { createIdeaNode } from '../ideas/idea-node.js';

/** @returns {ScheduleDay} */
export function createEmptyScheduleDay() {
  return {
    required: [],
    optional: [],
    ideas: [],
    milestones: [],
    reflection: '',
    reflectionTags: [],
    aiEval: ''
  };
}

/**
 * @param {any} raw
 * @returns {import('../ideas/idea-node.js').IdeaNode[]}
 */
function normalizeIdeas(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && (t.id || t.text))
    .map((t) =>
      createIdeaNode({
        id: t.id,
        text: t.text || '',
        note: t.note || '',
        completed: !!t.completed,
        pinned: !!t.pinned,
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : typeof t.time === 'number' ? t.time : Date.now(),
        dueDate: t.dueDate ?? null,
        dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
        position: t.position ?? null
      })
    );
}

/**
 * @param {any} raw
 * @returns {import('../milestone/milestone.js').Milestone[]}
 */
function normalizeMilestones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && m.id && m.title)
    .map((m) => ({
      id: m.id,
      title: String(m.title),
      date: String(m.date || ''),
      completed: !!m.completed
    }));
}

/**
 * @param {any} raw
 * @returns {ScheduleDay}
 */
export function normalizeScheduleDay(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyScheduleDay();
  const tags = Array.isArray(raw.reflectionTags)
    ? raw.reflectionTags
    : raw.reflectionTag
      ? [raw.reflectionTag]
      : [];
  return {
    required: Array.isArray(raw.required) ? raw.required : [],
    optional: Array.isArray(raw.optional) ? raw.optional : [],
    ideas: normalizeIdeas(raw.ideas),
    milestones: normalizeMilestones(raw.milestones),
    reflection: typeof raw.reflection === 'string' ? raw.reflection : '',
    reflectionTags: tags,
    aiEval: typeof raw.aiEval === 'string' ? raw.aiEval : ''
  };
}

/**
 * Copy unfinished required/optional from prev into current.
 * Ideas and milestones are day-scoped and are never copied.
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
      if (!t.completed && !existingIds.has(t.id)) {
        current[type].push({ ...t });
      }
    });
  });
  return current;
}

/**
 * Copy unfinished ideas from prev day into current day (explicit「同步灵感」only).
 * Milestones are never copied. Completed ideas are skipped; existing ids are skipped.
 * DependsOn is remapped to the target day: idea refs kept only if that id exists on
 * current; daily refs rewritten to currentKey only if the same task exists there.
 *
 * @param {ScheduleDay|null|undefined} prev
 * @param {ScheduleDay} current
 * @param {{ prevKey?: string, currentKey?: string }} [keys]
 * @returns {ScheduleDay}
 */
export function syncPrevDayIdeas(prev, current, keys = {}) {
  if (!prev) return current;
  if (!Array.isArray(current.ideas)) current.ideas = [];
  const existingIds = new Set(current.ideas.map((n) => n.id));
  const newlyCopied = [];
  (prev.ideas || []).forEach((n) => {
    if (!n || !n.id || n.completed || existingIds.has(n.id)) return;
    const copy = createIdeaNode({
      id: n.id,
      text: n.text || '',
      note: n.note || '',
      completed: false,
      pinned: !!n.pinned,
      createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
      dueDate: n.dueDate ?? null,
      dependsOn: Array.isArray(n.dependsOn) ? n.dependsOn.map((r) => ({ ...r })) : [],
      position: n.position ? { ...n.position } : null
    });
    current.ideas.push(copy);
    newlyCopied.push(copy);
    existingIds.add(n.id);
  });

  const currentKey = keys.currentKey;
  const ideaIds = new Set(current.ideas.map((n) => n.id));
  newlyCopied.forEach((idea) => {
    idea.dependsOn = remapDependsOnForDay(idea.dependsOn, current, currentKey, ideaIds);
  });
  return current;
}

/**
 * @param {import('../ideas/idea-node.js').TaskRef[]} deps
 * @param {ScheduleDay} day
 * @param {string|undefined} currentKey
 * @param {Set<string>} ideaIds
 * @returns {import('../ideas/idea-node.js').TaskRef[]}
 */
function remapDependsOnForDay(deps, day, currentKey, ideaIds) {
  if (!Array.isArray(deps) || !deps.length) return [];
  /** @type {import('../ideas/idea-node.js').TaskRef[]} */
  const out = [];
  deps.forEach((ref) => {
    if (!ref) return;
    if (ref.scope === 'idea') {
      if (ideaIds.has(ref.id)) out.push({ scope: 'idea', id: ref.id });
      return;
    }
    if (ref.scope === 'daily') {
      const listName = ref.list === 'optional' ? 'optional' : 'required';
      const list = day[listName] || [];
      if (!list.some((t) => t && t.id === ref.id)) return;
      out.push({
        scope: 'daily',
        dateKey: currentKey || ref.dateKey,
        list: listName,
        id: ref.id
      });
    }
  });
  return out;
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
