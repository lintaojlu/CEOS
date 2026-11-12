/**
 * 四个洞察共用的数字快照。提示词只引用这里的数字，避免模型自行加总。
 */

import { normalizeTagIds } from '../schedule/daily-task.js';
import { partitionIdeas } from '../ideas/readiness.js';
import { addDays, diffDays, getDateKey, parseDateKey } from '../shared/date-key.js';
import { summarizeActivity } from '../stats/activity-stats.js';
import { dayView } from '../schedule/schedule-document.js';
import { dayCompletion } from '../stats/day-completion.js';
import { forEachPlainTaskDay, indexDayStats, indexedCompletion } from '../stats/day-index.js';

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
function aggregate(schedule, keys, stats) {
  let completed = 0;
  let total = 0;
  keys.forEach((key) => {
    const stat = stats ? indexedCompletion(stats.get(key)) : dayCompletion(dayView(schedule, key));
    if (!stat) return;
    completed += stat.completed;
    total += stat.total;
  });
  return { completed, total, rate: total > 0 ? completed / total : null };
}

/**
 * @param {Record<string, any>} schedule
 * @param {string} todayKey
 * @param {Map<string, { allDone: number, allTotal: number }>|null} stats
 */
function weakestWeekday(schedule, todayKey, stats) {
  const buckets = Array.from({ length: 7 }, () => ({ completed: 0, total: 0 }));
  const keys = stats ? [...stats.keys()] : Object.keys(schedule || {});
  keys.forEach((dateKey) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey > todayKey) return;
    const stat = stats ? indexedCompletion(stats.get(dateKey)) : dayCompletion(dayView(schedule, dateKey));
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
 * @param {{ ideas?: any[], tags?: any[] }} input.workspace
 * @param {string} input.todayKey
 */
export function buildInsightSnapshot({ schedule, workspace, ideas, todayKey }) {
  const data = schedule || {};
  const ideaList = (ideas || workspace?.ideas || []).filter(Boolean);
  const tags = workspace?.tags || [];
  const last7 = keysEnding(todayKey, 7);
  const prev7 = keysEnding(getDateKey(addDays(parseDateKey(todayKey), -7)), 7);
  const last30 = keysEnding(todayKey, 30);
  const stats = indexDayStats(data);
  const activity = summarizeActivity(data, { today: todayKey });
  const recent = new Set(last7);

  const recentTagIds = new Set();
  const totals = new Map();
  function tally(key, task) {
    normalizeTagIds(task).forEach((tagId) => {
      const row = totals.get(tagId) || { done: 0, total: 0 };
      row.total += 1;
      if (task.completed) {
        row.done += 1;
        if (recent.has(key)) recentTagIds.add(tagId);
      }
      totals.set(tagId, row);
    });
  }
  if (!forEachPlainTaskDay(data, (key, task) => {
    if (key <= todayKey) tally(key, task);
  })) {
    Object.keys(data).forEach((key) => {
      const day = data[key];
      if (!day) return;
      [...(day.required || []), ...(day.optional || [])].forEach((task) => tally(key, task));
    });
  }

  const tagRows = tags
    .map((tag) => {
      const counts = totals.get(tag.id) || { done: 0, total: 0 };
      return {
        id: tag.id,
        name: tag.name,
        done: counts.done,
        total: counts.total,
        stalled: counts.total > counts.done && !recentTagIds.has(tag.id)
      };
    })
    .filter((row) => row.total > 0);

  const partitioned = partitionIdeas(ideaList, {
    schedule: data,
    ideas: ideaList,
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
  const overdueCount = 0;

  return {
    todayKey,
    completion: {
      last7: aggregate(data, last7, stats),
      prev7: aggregate(data, prev7, stats),
      last30: aggregate(data, last30, stats),
      last7Rate: aggregate(data, last7, stats).rate,
      prev7Rate: aggregate(data, prev7, stats).rate,
      last30Rate: aggregate(data, last30, stats).rate
    },
    rhythm: {
      ...activity,
      weakest: weakestWeekday(data, todayKey, stats)
    },
    tags: {
      rows: tagRows,
      stalled: tagRows.filter((row) => row.stalled).map((row) => row.name)
    },
    ideas: {
      total: ideaList.length,
      ready: partitioned.ready.length,
      waiting: partitioned.waiting.length,
      archived: partitioned.archived.length,
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
