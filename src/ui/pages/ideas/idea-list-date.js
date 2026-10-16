/** 灵感列表右侧日期：今天、昨天，或「M月D日」。 */
export function ideaListDate(createdAt, now = new Date()) {
  const date = new Date(Number(createdAt) || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const start = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86400000);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
