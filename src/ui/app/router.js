/** Hash 路由。页名只允许名单内的，非法地址回到上次记住的页面。 */

export const PAGES = [
  { id: 'home', label: '首页' },
  { id: 'tasks', label: '任务' },
  { id: 'ideas', label: '灵感' },
  { id: 'agent', label: 'Agent' }
];

/** @param {string} hash @returns {'home'|'tasks'|'ideas'|'agent'|null} */
export function pageFromHash(hash) {
  const name = String(hash || '').replace(/^#\/?/, '').split(/[?#]/)[0];
  return PAGES.some((page) => page.id === name) ? name : null;
}

/** @param {'home'|'tasks'|'ideas'|'agent'} page */
export function navigate(page) {
  const next = `#/${page}`;
  if (window.location.hash !== next) window.location.hash = next;
}
