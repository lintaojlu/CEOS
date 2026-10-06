/**
 * 一天的任务完成情况。无任务的日子返回 null，不参与完成率。
 */

/**
 * @param {import('../../data/schedule-record.js').ScheduleDayRecord|null|undefined} day
 * @returns {{ completed: number, total: number, rate: number }|null}
 */
export function dayCompletion(day) {
  if (!day) return null;
  const tasks = [...(day.required || []), ...(day.optional || [])].filter(Boolean);
  if (tasks.length === 0) return null;
  const completed = tasks.filter((task) => task.completed).length;
  return { completed, total: tasks.length, rate: completed / tasks.length };
}

/**
 * 只统计必做。没有必做时返回 null，选做不计入完成率。
 * @param {import('../../data/schedule-record.js').ScheduleDayRecord|null|undefined} day
 * @returns {{ completed: number, total: number, rate: number }|null}
 */
export function requiredCompletion(day) {
  if (!day) return null;
  const tasks = (day.required || []).filter(Boolean);
  if (tasks.length === 0) return null;
  const completed = tasks.filter((task) => task.completed).length;
  return { completed, total: tasks.length, rate: completed / tasks.length };
}

/**
 * 热力亮度。0 表示没有任务；1–4 按完成率递增。
 * @param {number|null|undefined} rate
 * @returns {0|1|2|3|4}
 */
export function rateLevel(rate) {
  if (rate == null || Number.isNaN(rate)) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.5) return 2;
  if (rate <= 0.75) return 3;
  return 4;
}

/**
 * 活跃热力图：没有数据、0、0–40 低、40–80 中、80–100 高。
 * @param {number|null|undefined} rate
 * @returns {0|1|2|3|4}
 */
export function activityRateLevel(rate) {
  if (rate == null || Number.isNaN(rate)) return 0;
  if (rate <= 0) return 1;
  if (rate <= 0.4) return 2;
  if (rate <= 0.8) return 3;
  return 4;
}
