/** 标签胶囊和任务行圆点共用的固定颜色，按创建顺序取用。 */
export const TAG_PALETTE = [
  '#1F9D8A',
  '#E56B6F',
  '#3B6FE0',
  '#6BBF59',
  '#8B7FD4',
  '#8E8E93',
  '#8E4A6B',
  '#D4923A'
];

/**
 * 优先用还没被占用的颜色，用完后再按名单长度循环。
 * @param {Array<{ color?: string }>|null|undefined} tags
 * @returns {string}
 */
export function nextTagColor(tags) {
  const used = new Set((tags || []).map((tag) => tag && tag.color).filter(Boolean));
  const free = TAG_PALETTE.find((color) => !used.has(color));
  if (free) return free;
  return TAG_PALETTE[(tags || []).length % TAG_PALETTE.length];
}
