/**
 * TypeSafe System One。一次请求提交文本 state 和若干类型化问题。
 * 桌面端由应用进程发请求，避免页面跨域被 WebKit 报成 Load failed。
 */

import { LlmRequestError } from './openai-compatible-client.js';
import { llmTransport } from './tauri-llm-fetch.js';

/** @param {string} baseUrl */
export function systemOneUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/$/, '');
  return trimmed ? `${trimmed}/systemone` : '';
}

/** @param {string} baseUrl */
export function systemOneModelsUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/$/, '');
  return trimmed ? `${trimmed}/models` : '';
}

/**
 * @param {Response|{ ok: boolean, status: number, json: () => Promise<any> }} response
 * @returns {Promise<any>}
 */
async function readJson(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new LlmRequestError(`JEV 返回无法解析（HTTP ${response.status}）`, 'http');
  }
  if (!response.ok) {
    const raw = data && (data.error?.message || data.error);
    const message = typeof raw === 'string' ? raw : `JEV 返回 HTTP ${response.status}`;
    throw new LlmRequestError(message, 'http');
  }
  return data;
}

/**
 * @param {object} input
 * @param {string} input.baseUrl
 * @param {string} input.apiKey
 * @param {string} input.model
 * @param {object} input.state
 * @param {object} input.questions
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<{ model?: string, answers?: Record<string, any> }>}
 */
export async function evaluateSystemOne({ baseUrl, apiKey, model, state, questions, fetchImpl }) {
  const fetchFn = fetchImpl || llmTransport;
  const url = systemOneUrl(baseUrl);
  if (!url || !apiKey || !model) {
    throw new LlmRequestError('请先在设置中填写 JEV 的 API Key', 'not-configured');
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
      body: JSON.stringify({ model, state, questions })
    });
  } catch (error) {
    const message = error && error.message ? error.message : '网络请求失败';
    throw new LlmRequestError(message, 'network');
  }
  return readJson(response);
}

/**
 * @param {object} input
 * @param {string} input.baseUrl
 * @param {string} input.apiKey
 * @param {typeof fetch} [input.fetchImpl]
 * @returns {Promise<string[]>}
 */
export async function listSystemOneModels({ baseUrl, apiKey, fetchImpl }) {
  const fetchFn = fetchImpl || llmTransport;
  const url = systemOneModelsUrl(baseUrl);
  if (!url || !apiKey) {
    throw new LlmRequestError('请先填写 JEV 的请求地址和 API Key', 'not-configured');
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
  const data = await readJson(response);
  const rows = Array.isArray(data?.models) ? data.models : [];
  const ids = rows.map((item) => (typeof item === 'string' ? item : item?.name)).filter((id) => typeof id === 'string' && id.trim());
  return [...new Set(ids)];
}
