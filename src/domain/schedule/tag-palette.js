/** 标签胶囊和任务行圆点共用的固定颜色，按色板从左到右、再下一行取用。 */
export const TAG_PALETTE = [
  '#FFFFFF',
  '#A16C39',
  '#FC2D3E',
  '#FA6710',
  '#F79410',
  '#14C370',
  '#15B8A4',
  '#1784FC',
  '#915BFC',
  '#FB3399',
  '#777777'
];

/** 白字在这些底上不清楚，胶囊改用纸色字。 */
export const TAG_LIGHT_FILLS = new Set([
  '#ffffff',
  '#fa6710',
  '#f79410',
  '#14c370',
  '#15b8a4'
]);

/** 上一版色板和更早的黄、黑，打开时落到现在这一组。 */
const LEGACY_TAG_COLORS = {
  '#f5c400': '#F79410',
  '#111111': '#777777',
  '#1f9d8a': '#15B8A4',
  '#e56b6f': '#FC2D3E',
  '#3b6fe0': '#1784FC',
  '#6bbf59': '#14C370',
  '#8b7fd4': '#915BFC',
  '#8e8e93': '#777777',
  '#8e4a6b': '#FB3399',
  '#d4923a': '#FA6710'
};

/**
 * @param {string} [color]
 * @returns {string}
 */
export function canonicalTagColor(color) {
  const value = String(color || '').trim();
  if (!value) return '';
  const key = value.toLowerCase();
  const exact = TAG_PALETTE.find((item) => item.toLowerCase() === key);
  if (exact) return exact;
  return LEGACY_TAG_COLORS[key] || value;
}

/**
 * 优先用还没被占用的颜色，用完后再按名单长度循环。
 * @param {Array<{ color?: string }>|null|undefined} tags
 * @returns {string}
 */
export function nextTagColor(tags) {
  const used = new Set((tags || []).map((tag) => tag && canonicalTagColor(tag.color)).filter(Boolean));
  const free = TAG_PALETTE.find((color) => !used.has(color));
  if (free) return free;
  return TAG_PALETTE[(tags || []).length % TAG_PALETTE.length];
}
