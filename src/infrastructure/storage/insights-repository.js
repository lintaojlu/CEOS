/**
 * 洞察文本缓存，按日期和洞察 id 存放。
 * 数字每次从日程重算，这里只留模型生成的句子，丢掉也不影响任务数据。
 */

const KEY = 'ceoInsights';

/**
 * @typedef {Object} InsightEntry
 * @property {string} text
 * @property {string} generatedAt
 */

export class InsightsRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {Record<string, Record<string, InsightEntry>>} */
  load() {
    const raw = this.adapter.getJson(KEY, {});
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  }

  /**
   * @param {string} dateKey
   * @returns {Record<string, InsightEntry>}
   */
  getDay(dateKey) {
    const day = this.load()[dateKey];
    return day && typeof day === 'object' ? day : {};
  }

  /**
   * @param {string} dateKey
   * @param {Record<string, InsightEntry>} day
   */
  saveDay(dateKey, day) {
    const all = this.load();
    all[dateKey] = day;
    this.adapter.setJson(KEY, all);
  }
}

export { KEY as INSIGHTS_KEY };
