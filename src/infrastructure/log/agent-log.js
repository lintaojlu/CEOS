/**
 * 开发者日志。桌面窗口里追加到本机 agent.jsonl。测试和浏览器里不写文件。
 * @param {any} record
 */
export async function appendAgentLog(record) {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('append_agent_log', { line: JSON.stringify(record) });
}
