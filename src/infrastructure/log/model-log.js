/**
 * 模型调用日志。桌面窗口里追加到本机 model.jsonl，和日程代理的对话日志分开。
 * 测试和浏览器里不写文件。
 */
import { redact } from '../../domain/agent/redact.js';

/** @param {any} record */
export async function appendModelLog(record) {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('append_model_log', { line: JSON.stringify(record) });
}

/**
 * 写失败不影响模型请求。
 * @param {((record: any) => Promise<void>|void)|undefined} log
 * @param {any} record
 */
export async function recordModelCall(log, record) {
  const write = log || appendModelLog;
  try {
    await write(redact({
      kind: 'model_call',
      ...record,
      time: new Date().toISOString()
    }));
  } catch {
    // 日志写不进去时，请求结果照常返回。
  }
}
