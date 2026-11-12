/**
 * 全局日程按天摊开的完成数。点统计时不能对每一天再扫整份任务。
 */

import { covers, isScheduleDocument } from '../schedule/schedule-document.js';
import { shiftDateKey } from '../shared/date-key.js';

const DAY_SPAN_LIMIT = 8000;

/** @param {import('../schedule/schedule-document.js').ScheduleDocument} doc */
function taskMap(doc) {
  const tasks = new Map();
  (doc.tasks || []).forEach((task) => {
    if (task?.id) tasks.set(task.id, task);
  });
  return tasks;
}

/** @param {import('../schedule/schedule-document.js').ScheduleDocument} doc */
function groupMap(doc) {
  const groups = new Map();
  (doc.groups || []).forEach((group) => {
    if (group?.id) groups.set(group.id, group);
  });
  return groups;
}

/**
 * @param {{ start?: string, due?: string }} task
 * @param {(dateKey: string) => void} visit
 */
function eachCoveredDay(task, visit) {
  const start = task?.start || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(task.due || '') ? task.due : start;
  if (due < start) return;
  let cursor = start;
  let guard = 0;
  while (cursor <= due && guard < DAY_SPAN_LIMIT) {
    if (covers(task, cursor)) visit(cursor);
    if (cursor === due) break;
    const next = shiftDateKey(cursor, 1);
    if (next === cursor) break;
    cursor = next;
    guard += 1;
  }
}

function blankRow() {
  return { allDone: 0, allTotal: 0, reqDone: 0, reqTotal: 0 };
}

/**
 * 非全局日程返回 null，调用方继续按天读取。
 * @param {any} schedule
 * @returns {Map<string, { allDone: number, allTotal: number, reqDone: number, reqTotal: number }>|null}
 */
export function indexDayStats(schedule) {
  if (!isScheduleDocument(schedule)) return null;
  const tasks = taskMap(schedule);
  const groups = groupMap(schedule);
  /** @type {Map<string, { allDone: number, allTotal: number, reqDone: number, reqTotal: number }>} */
  const days = new Map();

  function bump(dateKey, list, completed) {
    let row = days.get(dateKey);
    if (!row) {
      row = blankRow();
      days.set(dateKey, row);
    }
    row.allTotal += 1;
    if (completed) row.allDone += 1;
    if (list === 'required') {
      row.reqTotal += 1;
      if (completed) row.reqDone += 1;
    }
  }

  ['required', 'optional'].forEach((list) => {
    (schedule.order?.[list] || []).forEach((id) => {
      const group = groups.get(id);
      if (group && group.list === list) {
        const children = (group.childIds || []).map((childId) => tasks.get(childId)).filter(Boolean);
        if (children.length < 2) return;
        const covered = new Set();
        children.forEach((child) => eachCoveredDay(child, (dateKey) => covered.add(dateKey)));
        covered.forEach((dateKey) => {
          const visible = children.filter((child) => covers(child, dateKey));
          if (visible.length >= 2) visible.forEach((child) => bump(dateKey, list, !!child.completed));
          else if (visible.length === 1) bump(dateKey, list, !!visible[0].completed);
        });
        return;
      }
      const task = tasks.get(id);
      if (!task || task.groupId || task.list !== list) return;
      eachCoveredDay(task, (dateKey) => bump(dateKey, list, !!task.completed));
    });
  });
  return days;
}

/** @param {{ allDone: number, allTotal: number }|undefined} row */
export function indexedCompletion(row) {
  if (!row || !row.allTotal) return null;
  return { completed: row.allDone, total: row.allTotal, rate: row.allDone / row.allTotal };
}

/** @param {{ reqDone: number, reqTotal: number }|undefined} row */
export function indexedRequired(row) {
  if (!row || !row.reqTotal) return null;
  return { completed: row.reqDone, total: row.reqTotal, rate: row.reqDone / row.reqTotal };
}

/**
 * 全局日程里，不在分组里的任务按它覆盖的每一天回调一次。分组行没有标签，不回调。
 * @param {any} schedule
 * @param {(dateKey: string, task: any) => void} visit
 * @returns {boolean}
 */
export function forEachPlainTaskDay(schedule, visit) {
  if (!isScheduleDocument(schedule)) return false;
  const tasks = taskMap(schedule);
  const groups = groupMap(schedule);
  ['required', 'optional'].forEach((list) => {
    (schedule.order?.[list] || []).forEach((id) => {
      const group = groups.get(id);
      if (group && group.list === list) return;
      const task = tasks.get(id);
      if (!task || task.groupId || task.list !== list) return;
      eachCoveredDay(task, (dateKey) => visit(dateKey, task));
    });
  });
  return true;
}
