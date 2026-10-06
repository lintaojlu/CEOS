/**
 * LLM 连接设置。只存在本机 localStorage，不进仓库、不进日程记录。
 */

const KEY = 'ceoLlmSettings';

export const DEFAULT_LLM_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

/**
 * @typedef {Object} LlmSettings
 * @property {string} baseUrl 服务端点；fullUrl 为 true 时是完整请求地址
 * @property {boolean} fullUrl 为 true 时 baseUrl 已包含路径，不再自动拼接
 * @property {string} apiKey
 * @property {string} model
 */

/** @param {any} raw @returns {LlmSettings} */
export function normalizeLlmSettings(raw) {
  const baseUrl = typeof raw?.baseUrl === 'string' ? raw.baseUrl.trim().replace(/\/$/, '') : '';
  return {
    baseUrl: baseUrl || DEFAULT_LLM_BASE_URL,
    fullUrl: raw?.fullUrl === true,
    apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : '',
    model: typeof raw?.model === 'string' ? raw.model.trim() : ''
  };
}

export class LlmSettingsRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {LlmSettings} */
  load() {
    return normalizeLlmSettings(this.adapter.getJson(KEY, {}));
  }

  /** @param {Partial<LlmSettings>} settings @returns {LlmSettings} */
  save(settings) {
    const next = normalizeLlmSettings(settings);
    this.adapter.setJson(KEY, next);
    return next;
  }
}

export { KEY as LLM_SETTINGS_KEY };
