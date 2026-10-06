/**
 * 活跃统计与热力图。只读日程记录，不写存储。
 * 活跃日：当天至少完成 1 条必做或选做。无任务的日子不算活跃，也不打断之外的空档由日历连续计算。
 */

import { addDays, diffDays, getDateKey, parseDateKey, startOfWeek } from '../shared/date-key.js';
import { activityRateLevel, dayCompletion, requiredCompletion } from './day-completion.js';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** 格子边长，和样式里的 16px 一致。 */
export const HEAT_CELL = 16;
/** 列间距的下限。多出来的宽度摊进间距，让左右顶格。 */
export const HEAT_MIN_GAP = 6;
/** 星期标签列宽加上它和格子之间的空隙。 */
export const HEAT_LABEL = 30;
/** 右端停在今天所在周，并保留足够早的周，方便翻页。 */
export const HEATMAP_HISTORY_WEEKS = 400;

/**
 * 当前宽度里能放下多少周，格子保持 16px。
 * @param {number} contentWidth
 * @returns {number}
 */
export function visibleWeekCount(contentWidth) {
  const available = contentWidth - HEAT_LABEL;
  if (!(available >= HEAT_CELL)) return 1;
  return Math.max(1, Math.floor((available + HEAT_MIN_GAP) / (HEAT_CELL + HEAT_MIN_GAP)));
}

/**
 * 把剩余宽度分给列间距，使最后一列贴住右缘。
 * @param {number} contentWidth
 * @param {number} count
 * @returns {number}
 */
export function heatColumnGap(contentWidth, count) {
  const available = contentWidth - HEAT_LABEL;
  if (count <= 1) return 0;
  return (available - count * HEAT_CELL) / (count - 1);
}

/**
 * @param {Record<string, any>} schedule
 * @param {string} todayKey
 * @returns {Set<string>}
 */
function activeDateSet(schedule, todayKey) {
  const active = new Set();
  Object.keys(schedule || {}).forEach((dateKey) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey > todayKey) return;
    const stat = dayCompletion(schedule[dateKey]);
    if (stat && stat.completed > 0) active.add(dateKey);
  });
  return active;
}

/**
 * @param {Set<string>} active
 * @param {string} endKey
 * @returns {number}
 */
function streakEndingAt(active, endKey) {
  let count = 0;
  let cursor = parseDateKey(endKey);
  if (!cursor) return 0;
  while (active.has(getDateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/**
 * @param {Record<string, any>} schedule
 * @param {{ today: string }} options today 为 YYYY-MM-DD
 * @returns {{ activeDays: number, currentStreak: number, longestStreak: number }}
 */
export function summarizeActivity(schedule, { today }) {
  const active = activeDateSet(schedule, today);
  const activeDays = active.size;

  const todayDate = parseDateKey(today);
  const yesterday = todayDate ? getDateKey(addDays(todayDate, -1)) : today;
  const streakAnchor = active.has(today) ? today : yesterday;
  const currentStreak = streakEndingAt(active, streakAnchor);

  let longestStreak = 0;
  if (active.size > 0) {
    const sorted = [...active].sort();
    let cursor = parseDateKey(sorted[0]);
    const last = sorted[sorted.length - 1];
    let run = 0;
    while (cursor && getDateKey(cursor) <= last) {
      if (active.has(getDateKey(cursor))) {
        run += 1;
        if (run > longestStreak) longestStreak = run;
      } else {
        run = 0;
      }
      cursor = addDays(cursor, 1);
    }
  }

  return { activeDays, currentStreak, longestStreak };
}

/**
 * @typedef {Object} HeatCell
 * @property {string} dateKey
 * @property {boolean} future
 * @property {number|null} rate
 * @property {number} completed
 * @property {number} total
 * @property {0|1|2|3|4} level
 */

/**
 * 右端是今天所在周。左端至少再往前留一长段，有更早日程时覆盖到那天。
 * @param {string} today
 * @param {Record<string, any>} [schedule]
 * @returns {{ first: Date, weeks: number }}
 */
export function heatmapSpan(today, schedule) {
  const todayDate = parseDateKey(today) || new Date();
  const lastWeek = startOfWeek(todayDate);
  let first = addDays(lastWeek, -(HEATMAP_HISTORY_WEEKS - 1) * 7);
  const keys = Object.keys(schedule || {})
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= today)
    .sort();
  if (keys.length > 0) {
    const earliest = startOfWeek(parseDateKey(keys[0]) || lastWeek);
    if (earliest < first) first = earliest;
  }
  const weeks = Math.round(diffDays(getDateKey(first), getDateKey(lastWeek)) / 7) + 1;
  return { first, weeks };
}

/**
 * 列是周（周日到周六）。未传 weeks 时右端停在今天所在周，今天之后的格子标为 future。
 * @param {Record<string, any>} schedule
 * @param {{ weeks?: number, today: string }} options
 * @returns {{ monthLabel: string, days: HeatCell[] }[]}
 */
export function buildHeatmapWeeks(schedule, { weeks, today }) {
  const todayDate = parseDateKey(today) || new Date();
  const span = weeks == null ? heatmapSpan(today, schedule) : null;
  const count = span ? span.weeks : weeks;
  const first = span ? span.first : addDays(startOfWeek(todayDate), -(count - 1) * 7);
  /** @type {{ monthLabel: string, days: HeatCell[] }[]} */
  const columns = [];

  for (let week = 0; week < count; week += 1) {
    /** @type {HeatCell[]} */
    const days = [];
    let monthLabel = '';
    for (let dow = 0; dow < 7; dow += 1) {
      const date = addDays(first, week * 7 + dow);
      const dateKey = getDateKey(date);
      const future = dateKey > today;
      const stat = future ? null : requiredCompletion(schedule[dateKey]);
      if (date.getDate() === 1) monthLabel = MONTHS[date.getMonth()];
      days.push({
        dateKey,
        future,
        rate: stat ? stat.rate : null,
        completed: stat ? stat.completed : 0,
        total: stat ? stat.total : 0,
        level: future ? 0 : activityRateLevel(stat ? stat.rate : null)
      });
    }
    columns.push({ monthLabel, days });
  }

  return columns;
}
