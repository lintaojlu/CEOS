/**
 * 日历网格。只生成日期结构，不读取存储。
 * month 使用 1–12。一周从周日开始。
 */

import { addDays, getDateKey, parseDateKey, startOfWeek } from '../shared/date-key.js';
import { dayCompletion, rateLevel } from '../stats/day-completion.js';

/**
 * @param {number} year
 * @param {number} month 1–12
 * @returns {{ dateKey: string, inMonth: boolean }[][]}
 */
export function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const start = startOfWeek(first);
  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let dow = 0; dow < 7; dow += 1) {
      const date = addDays(start, week * 7 + dow);
      days.push({
        dateKey: getDateKey(date),
        inMonth: date.getMonth() === month - 1
      });
    }
    weeks.push(days);
  }
  return weeks;
}

/**
 * 包含 anchor 的那一周，周日到周六。
 * @param {Date|string} anchor
 * @returns {string[]}
 */
export function weekDays(anchor) {
  const date = typeof anchor === 'string' ? parseDateKey(anchor) : anchor;
  const start = startOfWeek(date || new Date());
  return Array.from({ length: 7 }, (_, index) => getDateKey(addDays(start, index)));
}

/**
 * @param {number} year
 * @returns {{ month: number, weeks: { dateKey: string, inMonth: boolean }[][] }[]}
 */
export function yearMonths(year) {
  return Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    weeks: monthGrid(year, index + 1)
  }));
}

/**
 * @param {import('../../data/schedule-record.js').ScheduleDayRecord|null|undefined} day
 * @param {Array<{ id: string, title: string, date: string, completed?: boolean }>} milestones
 * @param {string} dateKey
 */
export function summarizeDay(day, milestones, dateKey) {
  const stat = dayCompletion(day);
  return {
    dateKey,
    requiredCount: (day?.required || []).length,
    optionalCount: (day?.optional || []).length,
    completed: stat ? stat.completed : 0,
    total: stat ? stat.total : 0,
    rate: stat ? stat.rate : null,
    level: stat ? rateLevel(stat.rate) : 0,
    milestones: (milestones || []).filter((item) => item && item.date === dateKey)
  };
}
