/**
 * LLM 连接设置。只存在本机 localStorage，不进仓库、不进日程记录。
 */

const KEY = 'ceoLlmSettings';

export const DEFAULT_LLM_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const DEFAULT_JEV_BASE_URL = 'https://api.typesafe.ai/v1';
export const DEFAULT_JEV_MODEL = 'jev-latest';

/**
 * @typedef {Object} LlmSettings
 * @property {string} baseUrl 服务端点；fullUrl 为 true 时是完整请求地址
 * @property {boolean} fullUrl 为 true 时 baseUrl 已包含路径，不再自动拼接
 * @property {string} apiKey
 * @property {string} model 默认模型。其他行空着时用它
 * @property {string} agentModel 新对话的初始模型
 * @property {string} breakdownModel
 * @property {string} tagModel 创建标签
 * @property {string} standardizeModel
 * @property {string} jevApiKey TypeSafe 的 Key，和对话模型的 Key 分开
 * @property {string} jevBaseUrl System One 的地址，评估走 /systemone，列表走 /models
 * @property {string} jevModel 空着时用 jev-latest，不回退到对话模型
 */

/** @param {unknown} value @returns {string} */
function modelId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 某一行有值就用那一行。空着才用默认。默认这一行没有回退。
 * @param {Partial<LlmSettings>|null|undefined} settings
 * @param {'model'|'agentModel'|'breakdownModel'|'tagModel'|'standardizeModel'} [field]
 * @returns {string}
 */
export function resolveLlmModel(settings, field = 'model') {
  const chosen = field === 'model' ? '' : modelId(settings?.[field]);
  if (chosen) return chosen;
  return modelId(settings?.model);
}

/**
 * 空着才用 jev-latest。不借用对话模型。
 * @param {Partial<LlmSettings>|null|undefined} settings
 * @returns {string}
 */
export function resolveJevModel(settings) {
  return modelId(settings?.jevModel) || DEFAULT_JEV_MODEL;
}

/** @param {any} raw @returns {LlmSettings} */
export function normalizeLlmSettings(raw) {
  const baseUrl = typeof raw?.baseUrl === 'string' ? raw.baseUrl.trim().replace(/\/$/, '') : '';
  const jevBaseUrl = typeof raw?.jevBaseUrl === 'string' ? raw.jevBaseUrl.trim().replace(/\/$/, '') : '';
  const tagModel = modelId(raw?.tagModel) || modelId(raw?.smallModel);
  return {
    baseUrl: baseUrl || DEFAULT_LLM_BASE_URL,
    fullUrl: raw?.fullUrl === true,
    apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : '',
    model: modelId(raw?.model),
    agentModel: modelId(raw?.agentModel),
    breakdownModel: modelId(raw?.breakdownModel),
    tagModel,
    standardizeModel: modelId(raw?.standardizeModel),
    jevApiKey: typeof raw?.jevApiKey === 'string' ? raw.jevApiKey : '',
    jevBaseUrl: jevBaseUrl || DEFAULT_JEV_BASE_URL,
    jevModel: modelId(raw?.jevModel)
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
