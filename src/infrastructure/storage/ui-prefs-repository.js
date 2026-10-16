/**
 * 界面偏好：当前页、侧边栏是否收起。
 * 页面名单须与 router.PAGES 一致，否则记下的页会被丢回首页。
 */

const KEY = 'ceoUiPrefs';

export const UI_PAGES = ['home', 'tasks', 'ideas'];

/**
 * @typedef {Object} UiPrefs
 * @property {'home'|'tasks'|'ideas'} page
 * @property {boolean} sidebarHidden
 * @property {number} taskListHeight
 * @property {number} ideasListWidth
 */

export const TASK_LIST_HEIGHT = { min: 160, max: 840, default: 420 };
export const IDEA_LIST_WIDTH = { min: 200, max: 560, default: 300 };

/** @param {any} value */
export function normalizeTaskListHeight(value) {
  const height = Number(value);
  if (!Number.isFinite(height)) return TASK_LIST_HEIGHT.default;
  return Math.min(TASK_LIST_HEIGHT.max, Math.max(TASK_LIST_HEIGHT.min, Math.round(height)));
}

/** @param {any} value */
export function normalizeIdeaListWidth(value) {
  const width = Number(value);
  if (!Number.isFinite(width)) return IDEA_LIST_WIDTH.default;
  return Math.min(IDEA_LIST_WIDTH.max, Math.max(IDEA_LIST_WIDTH.min, Math.round(width)));
}

/** @param {any} raw @returns {UiPrefs} */
export function normalizeUiPrefs(raw) {
  return {
    page: UI_PAGES.includes(raw?.page) ? raw.page : 'home',
    sidebarHidden: raw?.sidebarHidden === true,
    taskListHeight: normalizeTaskListHeight(raw?.taskListHeight),
    ideasListWidth: normalizeIdeaListWidth(raw?.ideasListWidth)
  };
}

export class UiPrefsRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {UiPrefs} */
  load() {
    const raw = this.adapter.getJson(KEY, null);
    if (raw && typeof raw === 'object') return normalizeUiPrefs(raw);
    return normalizeUiPrefs({});
  }

  /** @param {Partial<UiPrefs>} prefs @returns {UiPrefs} */
  save(prefs) {
    const next = normalizeUiPrefs(prefs);
    this.adapter.setJson(KEY, next);
    return next;
  }
}

export { KEY as UI_PREFS_KEY };
