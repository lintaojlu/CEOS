import { normalizeTagIds } from './daily-task.js';

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
      normalizeTagIds(task).forEach((id) => used.add(id));
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
  return tag?.color || '';
}

/**
 * 胶囊底色。黄底用黑字，其余用白字。
 * @param {{ color?: string }|null|undefined} tag
 * @returns {{ background: string, color: string }}
 */
export function tagPillStyle(tag) {
  const background = displayTagColor(tag);
  return { background, color: background.toLowerCase() === '#f5c400' ? '#111111' : '#ffffff' };
}
