import { normalizeTagIds } from './daily-task.js';

/** 系统自带的标签。名称和颜色固定，不能改，也不能删。 */
export const FIXED_TAGS = [
  { id: 'tag-life', name: '生活', color: '#F5C400' },
  { id: 'tag-work', name: '工作', color: '#111111' }
];

/**
 * @param {{ id?: string, name?: string }|null|undefined} tag
 * @returns {boolean}
 */
export function isFixedTag(tag) {
  if (!tag) return false;
  return FIXED_TAGS.some((fixed) => fixed.id === tag.id || fixed.name === tag.name);
}

/**
 * 固定标签用指定颜色，其余标签用自己的颜色。
 * @param {{ id?: string, name?: string, color?: string }|null|undefined} tag
 * @returns {string}
 */
export function displayTagColor(tag) {
  const spec = FIXED_TAGS.find((fixed) => fixed.id === tag?.id || fixed.name === tag?.name);
  return spec?.color || tag?.color || '';
}

/**
 * 胶囊底色。黄底用黑字，其余用白字。
 * @param {{ id?: string, name?: string, color?: string }|null|undefined} tag
 * @returns {{ background: string, color: string }}
 */
export function tagPillStyle(tag) {
  const background = displayTagColor(tag);
  return { background, color: background.toLowerCase() === '#f5c400' ? '#111111' : '#ffffff' };
}

/**
 * 保证生活、工作在最前面。已有同名标签沿用它的 id，颜色改成固定的黄和黑。
 * @param {Array<{ id?: string, name?: string, color?: string }>|null|undefined} tags
 * @returns {Array<{ id: string, name: string, color: string }>}
 */
export function ensureFixedTags(tags) {
  const list = Array.isArray(tags) ? tags.map((tag) => ({ ...tag })) : [];
  /** @type {Array<{ id: string, name: string, color: string }>} */
  const fixed = [];
  FIXED_TAGS.forEach((spec) => {
    const index = list.findIndex((tag) => tag && (tag.id === spec.id || tag.name === spec.name));
    if (index >= 0) {
      const found = list.splice(index, 1)[0];
      fixed.push({
        id: String(found.id || spec.id),
        name: spec.name,
        color: spec.color
      });
      return;
    }
    fixed.push({
      id: spec.id,
      name: spec.name,
      color: spec.color
    });
  });
  return [...fixed, ...list.filter((tag) => tag && tag.id && tag.name)];
}

/**
 * 生活和工作每天都在。其余标签只在当天必做或选做挂着它时出现。
 * @param {Array<{ id?: string, name?: string, color?: string }>|null|undefined} tags
 * @param {{ required?: unknown[], optional?: unknown[] }|null|undefined} day
 * @returns {Array<{ id: string, name: string, color: string }>}
 */
export function tagsVisibleOnDay(tags, day) {
  const used = new Set();
  ['required', 'optional'].forEach((type) => {
    const tasks = day && typeof day === 'object' ? day[type] : null;
    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      normalizeTagIds(task).forEach((id) => used.add(id));
    });
  });
  return ensureFixedTags(tags).filter((tag) => isFixedTag(tag) || used.has(tag.id));
}
