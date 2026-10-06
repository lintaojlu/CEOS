/**
 * 界面偏好：当前页、灵感视图、日历粒度。替代旧的 ceoIdeasViewMode。
 */

const KEY = 'ceoUiPrefs';
const LEGACY_IDEAS_VIEW_KEY = 'ceoIdeasViewMode';

export const UI_PAGES = ['home', 'tasks', 'ideas', 'calendar'];
export const IDEA_VIEW_MODES = ['canvas', 'list'];
export const CALENDAR_MODES = ['week', 'month', 'year'];

/**
 * @typedef {Object} UiPrefs
 * @property {'home'|'tasks'|'ideas'|'calendar'} page
 * @property {'canvas'|'list'} ideasViewMode
 * @property {'week'|'month'|'year'} calendarMode
 */

/** @param {any} raw @returns {UiPrefs} */
export function normalizeUiPrefs(raw) {
  return {
    page: UI_PAGES.includes(raw?.page) ? raw.page : 'home',
    ideasViewMode: IDEA_VIEW_MODES.includes(raw?.ideasViewMode) ? raw.ideasViewMode : 'canvas',
    calendarMode: CALENDAR_MODES.includes(raw?.calendarMode) ? raw.calendarMode : 'month'
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
