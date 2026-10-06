/**
 * 四个洞察共用的数字快照。提示词只引用这里的数字，避免模型自行加总。
 */

import { partitionIdeas } from '../ideas/readiness.js';
import { addDays, diffDays, getDateKey, parseDateKey } from '../shared/date-key.js';
import { summarizeActivity } from '../stats/activity-stats.js';
import { dayCompletion } from '../stats/day-completion.js';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * @param {string} endKey
 * @param {number} count
 * @returns {string[]}
 */
function keysEnding(endKey, count) {
  const end = parseDateKey(endKey);
  if (!end) return [];
  const keys = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(getDateKey(addDays(end, -offset)));
  }
  return keys;
}

/**
 * @param {Record<string, any>} schedule
 * @param {string[]} keys
 */
function aggregate(schedule, keys) {
  let completed = 0;
  let total = 0;
  keys.forEach((key) => {
    const stat = dayCompletion(schedule[key]);
    if (!stat) return;
    completed += stat.completed;
    total += stat.total;
  });
  return { completed, total, rate: total > 0 ? completed / total : null };
}

/**
 * @param {Record<string, any>} schedule
 * @param {string} todayKey
 */
function weakestWeekday(schedule, todayKey) {
  const buckets = Array.from({ length: 7 }, () => ({ completed: 0, total: 0 }));
  Object.keys(schedule || {}).forEach((dateKey) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey > todayKey) return;
    const stat = dayCompletion(schedule[dateKey]);
    if (!stat) return;
    const date = parseDateKey(dateKey);
    if (!date) return;
    const bucket = buckets[date.getDay()];
    bucket.completed += stat.completed;
    bucket.total += stat.total;
  });
  let weakest = null;
  buckets.forEach((bucket, index) => {
    if (bucket.total === 0) return;
    const rate = bucket.completed / bucket.total;
    if (!weakest || rate < weakest.rate) {
      weakest = { weekday: WEEKDAYS[index], rate, completed: bucket.completed, total: bucket.total };
    }
  });
  return weakest;
}

/**
 * @param {object} input
 * @param {Record<string, any>} input.schedule
 * @param {{ ideas?: any[], projects?: any[] }} input.workspace
 * @param {string} input.todayKey
 */
export function buildInsightSnapshot({ schedule, workspace, todayKey }) {
  const data = schedule || {};
  const ideas = (workspace?.ideas || []).filter(Boolean);
  const projects = workspace?.projects || [];
  const last7 = keysEnding(todayKey, 7);
  const prev7 = keysEnding(getDateKey(addDays(parseDateKey(todayKey), -7)), 7);
  const last30 = keysEnding(todayKey, 30);
  const activity = summarizeActivity(data, { today: todayKey });

  const recentProjectIds = new Set();
  last7.forEach((key) => {
    const day = data[key];
    if (!day) return;
    [...(day.required || []), ...(day.optional || [])].forEach((task) => {
      if (task && task.completed && task.projectId) recentProjectIds.add(task.projectId);
    });
  });

  const projectRows = projects.map((project) => {
    const tasks = project.tasks || [];
    const done = tasks.filter((task) => task.completed).length;
    return {
      id: project.id,
      name: project.name,
      done,
      total: tasks.length,
      stalled: tasks.length > done && !recentProjectIds.has(project.id)
    };
  });

  const partitioned = partitionIdeas(ideas, {
    schedule: data,
    ideas,
    todayKey,
    dayKey: todayKey
  });
  const openIdeas = [...partitioned.ready, ...partitioned.waiting];
  const dwellDays = openIdeas.map((idea) => {
    const createdKey = getDateKey(new Date(idea.createdAt || Date.now()));
    return Math.max(0, diffDays(createdKey, todayKey));
  });
  const averageDwellDays = dwellDays.length
    ? Math.round(dwellDays.reduce((sum, days) => sum + days, 0) / dwellDays.length)
    : null;
  const overdueCount = ideas.filter((idea) => idea && !idea.completed && idea.dueDate && idea.dueDate < todayKey).length;

  return {
    todayKey,
    completion: {
      last7: aggregate(data, last7),
      prev7: aggregate(data, prev7),
      last30: aggregate(data, last30),
      last7Rate: aggregate(data, last7).rate,
      prev7Rate: aggregate(data, prev7).rate,
      last30Rate: aggregate(data, last30).rate
    },
    rhythm: {
      ...activity,
      weakest: weakestWeekday(data, todayKey)
    },
    projects: {
      rows: projectRows,
      stalled: projectRows.filter((row) => row.stalled).map((row) => row.name)
    },
    ideas: {
      total: ideas.length,
      ready: partitioned.ready.length,
      waiting: partitioned.waiting.length,
      completed: partitioned.completed.length,
      averageDwellDays,
      overdueCount
    }
  };
}

/** @param {number|null|undefined} rate */
export function formatRate(rate) {
  if (rate == null) return '无数据';
  return `${Math.round(rate * 100)}%`;
}
