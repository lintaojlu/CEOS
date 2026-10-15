import { createEmptyScheduleDay } from '../../data/schedule-record.js';
import { createDailyTask, createSubtask, normalizeSubtasks } from '../schedule/daily-task.js';
import { parseDateKey } from '../shared/date-key.js';
import { findTask } from './writes.js';

/**
 * @param {Record<string, any>} schedule
 * @param {string} date
 */
function ensureDay(schedule, date) {
  if (!schedule[date] || !Array.isArray(schedule[date].required) || !Array.isArray(schedule[date].optional)) {
    schedule[date] = createEmptyScheduleDay();
  }
  return schedule[date];
}

/**
 * @param {any[]} existing
 * @param {string[]} texts
 */
function replaceSubtasks(existing, texts) {
  return (texts || []).map((text) => {
    const found = (existing || []).find((item) => item && item.text === text);
    return found ? createSubtask(found.text, { id: found.id, completed: !!found.completed }) : createSubtask(text);
  });
}

/**
 * @param {any} task
 * @param {any} args
 */
function applyFields(task, args) {
  task.text = args.text;
  task.note = args.note || '';
  task.tagIds = args.tagId ? [args.tagId] : [];
  delete task.tagId;
  task.subtasks = replaceSubtasks(task.subtasks, args.subtasks);
}

/**
 * @param {any} day
 * @param {string} fromList
 * @param {string} toList
 * @param {string} taskId
 */
function moveList(day, fromList, toList, taskId) {
  if (fromList === toList) return;
  const index = (day[fromList] || []).findIndex((item) => item.id === taskId);
  if (index < 0) return;
  const [task] = day[fromList].splice(index, 1);
  day[toList].push(task);
}

/**
 * 按方案里的相对顺序，重排每个日期清单里被这次改动的任务。
 * @param {Record<string, any>} schedule
 * @param {any[]} calls
 */
function reorderProposal(schedule, calls) {
  /** @type {Record<string, string[]>} */
  const order = {};
  calls.forEach((call) => {
    if (call.name === 'remove_task') return;
    const id = call.name === 'pickup_idea' ? call.appliedId : call.name === 'create_task' ? call.appliedId : call.args.taskId;
    if (!id) return;
    const key = `${call.args.date}:${call.args.list}`;
    if (!order[key]) order[key] = [];
    order[key].push(id);
  });
  Object.keys(order).forEach((key) => {
    const [date, list] = key.split(':');
    const day = schedule[date];
    if (!day || !Array.isArray(day[list])) return;
    const wanted = order[key];
    const positions = [];
    day[list].forEach((task, index) => {
      if (wanted.includes(task.id)) positions.push(index);
    });
    if (!positions.length) return;
    const picked = wanted.map((id) => day[list].find((task) => task.id === id)).filter(Boolean);
    const rest = day[list].filter((task) => !wanted.includes(task.id));
    const insertAt = positions[0] - day[list].slice(0, positions[0]).filter((task) => wanted.includes(task.id)).length;
    rest.splice(Math.max(0, insertAt), 0, ...picked);
    day[list] = rest;
  });
}

/**
 * @param {{ schedule: Record<string, any>, ideas: any[] }} draft
 * @param {any[]} calls
 * @returns {{ ok: true } | { ok: false, index: number, error: string }}
 */
export function applyProposal(draft, calls) {
  const scratch = {
    schedule: structuredClone(draft.schedule),
    ideas: structuredClone(draft.ideas || [])
  };
  const schedule = scratch.schedule;
  for (let index = 0; index < calls.length; index += 1) {
    const call = calls[index];
    const args = call.args;
    try {
      if (call.name === 'create_task') {
        const day = ensureDay(schedule, args.date);
        const base = parseDateKey(args.date) || new Date();
        const task = createDailyTask(args.text, base, {
          note: args.note || '',
          tagIds: args.tagId ? [args.tagId] : [],
          subtasks: (args.subtasks || []).map((text) => createSubtask(text))
        });
        day[args.list].push(task);
        call.appliedId = task.id;
      } else if (call.name === 'update_task') {
        const found = findTask(schedule, args.date, args.taskId);
        if (!found) return { ok: false, index, error: '这一天没有这条任务' };
        const day = ensureDay(schedule, args.date);
        moveList(day, found.list, args.list, args.taskId);
        const current = findTask(schedule, args.date, args.taskId);
        if (!current) return { ok: false, index, error: '这一天没有这条任务' };
        applyFields(current.task, args);
      } else if (call.name === 'remove_task') {
        const day = schedule[args.date];
        if (!day) return { ok: false, index, error: '这一天没有这条任务' };
        let removed = false;
        ['required', 'optional'].forEach((list) => {
          const before = (day[list] || []).length;
          day[list] = (day[list] || []).filter((task) => task.id !== args.taskId);
          if (day[list].length !== before) removed = true;
        });
        if (!removed) return { ok: false, index, error: '这一天没有这条任务' };
      } else if (call.name === 'pickup_idea') {
        const idea = (scratch.ideas || []).find((item) => item.id === args.ideaId);
        if (!idea) return { ok: false, index, error: '灵感还不能捡起' };
        const day = ensureDay(schedule, args.date);
        const base = parseDateKey(args.date) || new Date();
        const task = createDailyTask(args.text || idea.text, base, {
          id: `${idea.id}-pickup-${Date.now()}-${index}`,
          note: args.note || idea.note || '',
          pinned: !!idea.pinned,
          tagIds: args.tagId ? [args.tagId] : [],
          subtasks: (args.subtasks || []).map((text) => createSubtask(text))
        });
        day[args.list].push(task);
        call.appliedId = task.id;
        scratch.ideas = (scratch.ideas || []).filter((item) => item.id !== idea.id);
        scratch.ideas.forEach((item) => {
          item.dependsOn = (item.dependsOn || []).filter((ref) => !(ref.scope === 'idea' && ref.id === idea.id));
        });
      } else if (call.name === 'copy_open_task') {
        const source = findTask(schedule, args.sourceDate, args.taskId);
        if (!source || source.task.completed) return { ok: false, index, error: '来源日没有这条未完成任务' };
        if (findTask(schedule, args.date, args.taskId)) return { ok: false, index, error: '目标日已经有这条任务' };
        const day = ensureDay(schedule, args.date);
        const copy = {
          ...source.task,
          text: args.text || source.task.text,
          note: args.note ?? source.task.note ?? '',
          completed: false,
          pomodoros: 0,
          tagIds: args.tagId ? [args.tagId] : [],
          subtasks: normalizeSubtasks(replaceSubtasks(source.task.subtasks, args.subtasks || []))
        };
        delete copy.tagId;
        delete copy.projectId;
        day[args.list].push(copy);
      } else {
        return { ok: false, index, error: '没有这个函数' };
      }
    } catch (error) {
      const message = error && error.message ? error.message : '写入失败';
      return { ok: false, index, error: message };
    }
  }
  reorderProposal(schedule, calls);
  draft.schedule = scratch.schedule;
  draft.ideas = scratch.ideas;
  return { ok: true };
}
