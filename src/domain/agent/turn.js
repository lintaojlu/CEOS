import { addDays, getDateKey, parseDateKey } from '../shared/date-key.js';

/**
 * @param {string} todayKey
 * @param {number} days
 * @returns {string}
 */
function shiftKey(todayKey, days) {
  const parsed = parseDateKey(todayKey);
  if (!parsed) return todayKey;
  return getDateKey(addDays(parsed, days));
}

/**
 * 这句话点名的日历日期。没点名时只有今天。页面正在看的那一天不参与。
 * @param {string} text
 * @param {string} today
 * @returns {string[]}
 */
export function writableDates(text, today) {
  const source = String(text || '');
  /** @type {Set<string>} */
  const dates = new Set();
  if (source.includes('今天') && /^\d{4}-\d{2}-\d{2}$/.test(today || '')) dates.add(today);
  if (source.includes('明天')) dates.add(shiftKey(today, 1));
  if (source.includes('后天')) dates.add(shiftKey(today, 2));
  for (const match of source.matchAll(/\d{4}-\d{2}-\d{2}/g)) dates.add(match[0]);
  const year = String(today || '').slice(0, 4);
  for (const match of source.matchAll(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    const key = `${year}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
    if (parseDateKey(key)) dates.add(key);
  }
  if (dates.size === 0 && /^\d{4}-\d{2}-\d{2}$/.test(today || '')) dates.add(today);
  return [...dates];
}

/**
 * 去掉安排命令、日期和件数后，还剩多少正文。
 * @param {string} text
 * @returns {string}
 */
export function taskRemainder(text) {
  return String(text || '')
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\d{1,2}\s*月\s*\d{1,2}\s*日/g, '')
    .replace(/今天|明天|后天/g, '')
    .replace(/只留\s*\d*\s*件/g, '')
    .replace(/就这些/g, '')
    .replace(/安排(一下|一排)?/g, '')
    .replace(/排一下|排一排/g, '')
    .replace(/必做|选做|日程/g, '')
    .replace(/帮我|请你|请/g, '')
    .replace(/[，。,.!！?？、\s]/g, '');
}

/**
 * @param {string} text
 * @param {{ viewedKey: string, today: string }} scope
 */
export function classifyTurn(text, scope) {
  const raw = String(text || '').trim();
  const remainder = taskRemainder(raw);
  const pureArrange = remainder.length === 0;
  const countMatch = raw.match(/只留\s*(\d+)\s*件/);
  const requiredCap = pureArrange ? (countMatch ? Number(countMatch[1]) : 3) : null;
  return {
    pureArrange,
    allowCreate: !pureArrange,
    allowRemove: /就这些|只留/.test(raw),
    requiredCap,
    writableDates: writableDates(raw, scope.today),
    remainder
  };
}
