/**
 * 前端直连 OpenAI 兼容接口。
 * 端点模式：地址 + /chat/completions、/models。
 * 完整 URL 模式：地址本身就是 chat/completions，模型列表去掉该后缀后请求 /models。
 */

/** @param {string} address @param {boolean} fullUrl */
export function chatCompletionsUrl(address, fullUrl) {
  const trimmed = String(address || '').trim();
  if (!trimmed) return '';
  if (fullUrl) return trimmed;
  return `${trimmed.replace(/\/$/, '')}/chat/completions`;
}

/** @param {string} address @param {boolean} fullUrl */
export function modelsUrl(address, fullUrl) {
  const trimmed = String(address || '').trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (!fullUrl) return `${trimmed}/models`;
  const base = trimmed.replace(/\/chat\/completions$/i, '').replace(/\/completions$/i, '');
  return `${base}/models`;
}

export class LlmRequestError extends Error {
  /**
   * @param {string} message
   * @param {'not-configured'|'http'|'empty'|'network'} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'LlmRequestError';
    this.code = code;
  }
}

/**
 * @param {object} input
 * @param {string} input.baseUrl
 * @param {boolean} [input.fullUrl]
 * @param {string} input.apiKey
 * @param {string} input.model
 * @param {string} [input.system]
 * @param {string} input.user
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<string>}
 */
export async function chatCompletion({ baseUrl, fullUrl = false, apiKey, model, system, user, fetchImpl }) {
  const fetchFn = fetchImpl || globalThis.fetch;
  const url = chatCompletionsUrl(baseUrl, fullUrl);
  if (!url || !apiKey || !model) {
    throw new LlmRequestError('请先在设置中填写 API 请求地址、默认模型和 API Key', 'not-configured');
  }
  if (typeof fetchFn !== 'function') {
    throw new LlmRequestError('当前环境不能发起网络请求', 'network');
  }
  let response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system || '你是一位简洁的中文助理。' },
          { role: 'user', content: user }
        ]
      })
    });
  } catch (error) {
    const message = error && error.message ? error.message : '网络请求失败';
    throw new LlmRequestError(message, 'network');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new LlmRequestError(`模型返回无法解析（HTTP ${response.status}）`, 'http');
  }

  if (!response.ok) {
    const raw = data && (data.error?.message || data.error);
    const message = typeof raw === 'string' ? raw : `模型返回 HTTP ${response.status}`;
    throw new LlmRequestError(message, 'http');
  }

  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (typeof text !== 'string' || !text.trim()) {
    throw new LlmRequestError('模型没有返回文本', 'empty');
  }
  return text.trim();
}

/**
 * @param {object} input
 * @param {string} input.baseUrl
 * @param {boolean} [input.fullUrl]
 * @param {string} input.apiKey
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<string[]>}
 */
export async function listModels({ baseUrl, fullUrl = false, apiKey, fetchImpl }) {
  const fetchFn = fetchImpl || globalThis.fetch;
  const url = modelsUrl(baseUrl, fullUrl);
  if (!url || !apiKey) {
    throw new LlmRequestError('请先填写 API 请求地址和 API Key', 'not-configured');
  }
  if (typeof fetchFn !== 'function') {
    throw new LlmRequestError('当前环境不能发起网络请求', 'network');
  }

  let response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  } catch (error) {
    const message = error && error.message ? error.message : '网络请求失败';
    throw new LlmRequestError(message, 'network');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new LlmRequestError(`模型列表无法解析（HTTP ${response.status}）`, 'http');
  }

  if (!response.ok) {
    const raw = data && (data.error?.message || data.error);
    const message = typeof raw === 'string' ? raw : `模型列表返回 HTTP ${response.status}`;
    throw new LlmRequestError(message, 'http');
  }

  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const ids = rows.map((item) => (typeof item === 'string' ? item : item?.id)).filter((id) => typeof id === 'string' && id.trim());
  return [...new Set(ids)];
}
