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
