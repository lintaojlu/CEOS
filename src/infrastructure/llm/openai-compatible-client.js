/**
 * OpenAI 兼容接口。
 * 端点模式：地址 + /chat/completions、/models。
 * 完整 URL 模式：地址本身就是 chat/completions，模型列表去掉该后缀后请求 /models。
 * 桌面端由应用进程发请求，避免页面跨域被 WebKit 报成 Load failed。
 */

import { llmTransport } from './tauri-llm-fetch.js';

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
 * @param {number} [input.maxTokens]
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<string>}
 */
export async function chatCompletion({ baseUrl, fullUrl = false, apiKey, model, system, user, maxTokens, fetchImpl }) {
  const fetchFn = fetchImpl || llmTransport;
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
        ],
        ...(maxTokens ? { max_tokens: maxTokens } : {})
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

/** 模型若带回思考，取 reasoning_content 或 reasoning。没有就是空字符串。 */
export function readReasoning(message) {
  const raw = message?.reasoning_content ?? message?.reasoning ?? '';
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('').trim();
  }
  return '';
}

/**
 * 带函数调用的补全。没有正文、也没有 tool_calls 时抛出 empty。
 * @param {object} input
 * @param {string} input.baseUrl
 * @param {boolean} [input.fullUrl]
 * @param {string} input.apiKey
 * @param {string} input.model
 * @param {any[]} input.messages
 * @param {any[]} input.tools
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<{ content: string, reasoning: string, toolCalls: { id: string, name: string, arguments: any }[] }>}
 */
export async function chatCompletionWithTools({ baseUrl, fullUrl = false, apiKey, model, messages, tools, fetchImpl }) {
  const fetchFn = fetchImpl || llmTransport;
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
      body: JSON.stringify({ model, messages, tools })
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

  const message = data && data.choices && data.choices[0] ? data.choices[0].message : null;
  const content = message && typeof message.content === 'string' ? message.content.trim() : '';
  const toolCalls = Array.isArray(message?.tool_calls)
    ? message.tool_calls.map((call, index) => {
      let args = {};
      const rawArgs = call?.function?.arguments;
      if (typeof rawArgs === 'string' && rawArgs.trim()) {
        try {
          args = JSON.parse(rawArgs);
        } catch {
          args = {};
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        args = rawArgs;
      }
      return {
        id: call?.id || `call-${index}`,
        name: call?.function?.name || '',
        arguments: args
      };
    }).filter((call) => call.name)
    : [];
  const reasoning = readReasoning(message);
  if (!content && !toolCalls.length) {
    throw new LlmRequestError('模型没有返回文本', 'empty');
  }
  return { content, reasoning, toolCalls };
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
  const fetchFn = fetchImpl || llmTransport;
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
