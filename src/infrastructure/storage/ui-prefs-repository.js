/**
 * 界面偏好：当前页、灵感视图、侧边栏是否收起。替代旧的 ceoIdeasViewMode。
 * 页面名单须与 router.PAGES 一致，否则记下的页会被丢回首页。
 */

const KEY = 'ceoUiPrefs';
const LEGACY_IDEAS_VIEW_KEY = 'ceoIdeasViewMode';

export const UI_PAGES = ['home', 'tasks', 'ideas'];
export const IDEA_VIEW_MODES = ['canvas', 'list'];

/**
 * @typedef {Object} UiPrefs
 * @property {'home'|'tasks'|'ideas'} page
 * @property {'canvas'|'list'} ideasViewMode
 * @property {boolean} sidebarHidden
 */

/** @param {any} raw @returns {UiPrefs} */
export function normalizeUiPrefs(raw) {
  return {
    page: UI_PAGES.includes(raw?.page) ? raw.page : 'home',
    ideasViewMode: IDEA_VIEW_MODES.includes(raw?.ideasViewMode) ? raw.ideasViewMode : 'canvas',
    sidebarHidden: raw?.sidebarHidden === true
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
    let ideasViewMode = 'canvas';
    try {
      const legacy = this.adapter.storage && this.adapter.storage.getItem(LEGACY_IDEAS_VIEW_KEY);
      if (legacy === 'list' || legacy === 'canvas') ideasViewMode = legacy;
    } catch {
      /* ignore */
    }
    return normalizeUiPrefs({ ideasViewMode });
  }

  /** @param {Partial<UiPrefs>} prefs @returns {UiPrefs} */
  save(prefs) {
    const next = normalizeUiPrefs(prefs);
    this.adapter.setJson(KEY, next);
    return next;
  }
}

export { KEY as UI_PREFS_KEY };
