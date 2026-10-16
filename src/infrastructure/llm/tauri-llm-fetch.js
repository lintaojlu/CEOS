/**
 * 桌面端不走页面里的 fetch。
 * WebKit 会因接口没有跨域响应头而失败，错误只剩 Load failed。
 * 应用进程发出的请求不受这条限制。
 */

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {{ inTauri?: boolean, fetchImpl?: typeof fetch, invoke?: (cmd: string, args: object) => Promise<{ status: number, body: string }> }} [deps]
 */
export async function llmTransport(url, init = {}, deps = {}) {
  const inTauri = deps.inTauri ?? (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  const fetchFn = deps.fetchImpl || globalThis.fetch;
  if (!inTauri) return fetchFn(url, init);

  const invoke = deps.invoke || (await import('@tauri-apps/api/core')).invoke;
  const headers = {};
  for (const [key, value] of Object.entries(init.headers || {})) {
    if (value != null) headers[key] = String(value);
  }
  let result;
  try {
    result = await invoke('llm_http', {
      method: init.method || 'GET',
      url,
      headers,
      body: typeof init.body === 'string' ? init.body : null
    });
  } catch (error) {
    const message = typeof error === 'string' ? error : (error?.message || '网络请求失败');
    throw new TypeError(message);
  }
  const status = Number(result?.status) || 0;
  const body = typeof result?.body === 'string' ? result.body : '';
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return JSON.parse(body);
    }
  };
}

/**
 * 边收边把正文交给 onChunk。页面里的 fetch 和桌面端的流式命令都走这里。
 * @param {string} url
 * @param {RequestInit & { signal?: AbortSignal }} init
 * @param {(chunk: string) => void} onChunk
 * @param {{ inTauri?: boolean, fetchImpl?: typeof fetch, invoke?: (cmd: string, args: object) => Promise<any>, Channel?: new (onmessage?: (message: any) => void) => { onmessage?: (message: any) => void }, createId?: () => string }} [deps]
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
export async function llmStream(url, init = {}, onChunk, deps = {}) {
  const inTauri = deps.inTauri ?? (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  if (!inTauri) return readFetchStream(url, init, onChunk, deps.fetchImpl || globalThis.fetch);

  const invoke = deps.invoke || (await import('@tauri-apps/api/core')).invoke;
  const Channel = deps.Channel || (await import('@tauri-apps/api/core')).Channel;
  const id = deps.createId ? deps.createId() : `llm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const channel = new Channel((message) => {
    const piece = typeof message === 'string' ? message : message?.chunk || '';
    if (piece) onChunk(piece);
  });
  const signal = init.signal;
  const abort = () => {
    invoke('llm_http_cancel', { id }).catch(() => {});
  };
  if (signal?.aborted) throw abortError();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const headers = headerMap(init.headers);
    const result = await invoke('llm_http_stream', {
      id,
      method: init.method || 'POST',
      url,
      headers,
      body: typeof init.body === 'string' ? init.body : null,
      channel
    });
    if (signal?.aborted) throw abortError();
    const status = Number(result?.status) || 0;
    return { ok: status >= 200 && status < 300, status };
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw abortError();
    const message = typeof error === 'string' ? error : (error?.message || '网络请求失败');
    if (message === '已停止') throw abortError();
    throw new TypeError(message);
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * @param {HeadersInit | undefined} headers
 */
function headerMap(headers) {
  /** @type {Record<string, string>} */
  const mapped = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (value != null) mapped[key] = String(value);
  }
  return mapped;
}

function abortError() {
  const error = new Error('已停止');
  error.name = 'AbortError';
  return error;
}

/**
 * @param {string} url
 * @param {RequestInit & { signal?: AbortSignal }} init
 * @param {(chunk: string) => void} onChunk
 * @param {typeof fetch} fetchFn
 */
async function readFetchStream(url, init, onChunk, fetchFn) {
  if (typeof fetchFn !== 'function') {
    throw new TypeError('当前环境不能发起网络请求');
  }
  const response = await fetchFn(url, init);
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      if (init.signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw abortError();
      }
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
    const tail = decoder.decode();
    if (tail) onChunk(tail);
  } else if (typeof response.json === 'function') {
    onChunk(JSON.stringify(await response.json()));
  }
  return {
    ok: response.ok,
    status: Number(response.status) || 0
  };
}
