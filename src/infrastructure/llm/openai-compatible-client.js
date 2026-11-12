/**
 * OpenAI Responses 接口。
 * 端点模式：地址 + /responses、/models。
 * 完整 URL 模式：地址本身就是请求地址，模型列表去掉 /responses 后请求 /models。
 * 桌面端由应用进程发请求，避免页面跨域被 WebKit 报成 Load failed。
 */

import { createChatStream } from './chat-stream.js';
import { modelsUrl, readResponsesOutput, responsesUrl, toResponsesBody } from './responses.js';
import { llmStream, llmTransport } from './tauri-llm-fetch.js';

export { modelsUrl, responsesUrl };

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
  const url = responsesUrl(baseUrl, fullUrl);
  if (!url || !apiKey || !model) {
    throw new LlmRequestError('请先在设置中填写 API 请求地址、默认模型和 API Key', 'not-configured');
  }
  if (typeof fetchFn !== 'function') {
    throw new LlmRequestError('当前环境不能发起网络请求', 'network');
  }
  const stream = createChatStream();
  let response;
  try {
    response = await llmStream(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(toResponsesBody({
        model,
        system: system || '你是一位简洁的中文助理。',
        user,
        maxTokens,
        stream: true
      }))
    }, (chunk) => stream.push(chunk), { fetchImpl });
  } catch (error) {
    const message = error && error.message ? error.message : '网络请求失败';
    throw new LlmRequestError(message, 'network');
  }

  const parsed = stream.finish();
  if (!response.ok) {
    throw new LlmRequestError(parsed.error || `模型返回 HTTP ${response.status}`, 'http');
  }
  if (parsed.error && !parsed.content.trim()) {
    throw new LlmRequestError(parsed.error, 'http');
  }
  if (!parsed.content.trim()) {
    throw new LlmRequestError('模型没有返回文本', 'empty');
  }
  return parsed.content.trim();
}

/**
 * 带函数调用的补全。没有正文、也没有函数调用时抛出 empty。
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
  const url = responsesUrl(baseUrl, fullUrl);
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
      body: JSON.stringify(toResponsesBody({ model, messages, tools }))
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

  const { content, reasoning, toolCalls } = readResponsesOutput(data);
  if (!content && !toolCalls.length) {
    throw new LlmRequestError('模型没有返回文本', 'empty');
  }
  return { content, reasoning, toolCalls };
}

/**
 * 带函数调用的流式补全。正文片段经 onDelta 送出，思考和工具参数留到结束。
 * @param {object} input
 * @param {string} input.baseUrl
 * @param {boolean} [input.fullUrl]
 * @param {string} input.apiKey
 * @param {string} input.model
 * @param {any[]} input.messages
 * @param {any[]} input.tools
 * @param {AbortSignal} [input.signal]
 * @param {(delta: { type: 'content', text: string } | { type: 'tools' }) => void} [input.onDelta]
 * @param {typeof fetch} [input.fetchImpl]
 * @param {boolean} [input.inTauri]
 * @param {(cmd: string, args: object) => Promise<any>} [input.invoke]
 * @param {new (onmessage?: (message: any) => void) => { onmessage?: (message: any) => void }} [input.Channel]
 * @returns {Promise<{ content: string, reasoning: string, toolCalls: { id: string, name: string, arguments: any }[] }>}
 */
export async function streamChatCompletionWithTools({
  baseUrl,
  fullUrl = false,
  apiKey,
  model,
  messages,
  tools,
  signal,
  onDelta,
  fetchImpl,
  inTauri,
  invoke,
  Channel
}) {
  const url = responsesUrl(baseUrl, fullUrl);
  if (!url || !apiKey || !model) {
    throw new LlmRequestError('请先在设置中填写 API 请求地址、默认模型和 API Key', 'not-configured');
  }
  const stream = createChatStream(onDelta);
  let response;
  try {
    response = await llmStream(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(toResponsesBody({ model, messages, tools, stream: true })),
      signal
    }, (chunk) => stream.push(chunk), { fetchImpl, inTauri, invoke, Channel });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    const message = error && error.message ? error.message : '网络请求失败';
    throw new LlmRequestError(message, 'network');
  }

  const parsed = stream.finish();
  if (!response.ok) {
    throw new LlmRequestError(parsed.error || `模型返回 HTTP ${response.status}`, 'http');
  }
  if (parsed.error && !parsed.content && !parsed.toolCalls.length) {
    throw new LlmRequestError(parsed.error, 'http');
  }
  if (!parsed.content.trim() && !parsed.toolCalls.length) {
    throw new LlmRequestError(parsed.error || '模型没有返回文本', 'empty');
  }
  return {
    content: parsed.content,
    reasoning: parsed.reasoning,
    toolCalls: parsed.toolCalls
  };
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
