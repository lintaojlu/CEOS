import { normalizeTagIds } from './daily-task.js';
import { TAG_LIGHT_FILLS, canonicalTagColor } from './tag-palette.js';

/**
 * 标签栏只显示当天有任务挂着的，以及被钉住的。生活、工作和其他标签同一套规则。
 * @param {Array<{ id?: string, name?: string, color?: string, pinned?: boolean }>|null|undefined} tags
 * @param {{ required?: unknown[], optional?: unknown[] }|null|undefined} day
 * @returns {Array<{ id?: string, name?: string, color?: string, pinned?: boolean }>}
 */
export function tagsVisibleOnDay(tags, day) {
  const used = new Set();
  ['required', 'optional'].forEach((type) => {
    const tasks = day && typeof day === 'object' ? day[type] : null;
    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      const rows = Array.isArray(task?.children) && task.children.length ? task.children : [task];
      rows.forEach((row) => normalizeTagIds(row).forEach((id) => used.add(id)));
    });
  });
  return (Array.isArray(tags) ? tags : []).filter((tag) => {
    if (!tag?.id || !tag?.name) return false;
    return tag.pinned === true || used.has(tag.id);
  });
}

/**
 * @param {{ color?: string }|null|undefined} tag
 * @returns {string}
 */
export function displayTagColor(tag) {
  return canonicalTagColor(tag?.color || '');
}

/**
 * 胶囊底色。白、橙、琥珀、绿、青用纸色字，其余用白字。
 * @param {{ color?: string }|null|undefined} tag
 * @returns {{ background: string, color: string }}
 */
export function tagPillStyle(tag) {
  const background = displayTagColor(tag);
  const light = TAG_LIGHT_FILLS.has(String(background).trim().toLowerCase());
  return { background, color: light ? '#141414' : '#ffffff' };
}
