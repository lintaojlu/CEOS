/**
 * 把 Responses 的流式输出收成正文、思考和工具调用。
 * 工具参数只留在结果里，不通过 onDelta 送出。
 */

import { parseArguments, readResponsesOutput } from './responses.js';

/**
 * @param {(delta: { type: 'content', text: string } | { type: 'tools' }) => void} [onDelta]
 */
export function createChatStream(onDelta) {
  let raw = '';
  let buffer = '';
  let sawSse = false;
  let sawTextDelta = false;
  /** @type {string} */
  let content = '';
  /** @type {string} */
  let reasoning = '';
  /** @type {{ id: string, name: string, arguments: string }[]} */
  const calls = [];
  let announcedTools = false;
  /** @type {string} */
  let error = '';

  function announceTools() {
    if (announcedTools) return;
    announcedTools = true;
    onDelta?.({ type: 'tools' });
  }

  /**
   * @param {number} index
   */
  function slotAt(index) {
    const at = Number.isInteger(index) && index >= 0 ? index : calls.length;
    while (calls.length <= at) calls.push({ id: '', name: '', arguments: '' });
    return calls[at];
  }

  /**
   * @param {any} json
   */
  function consume(json) {
    if (!json || typeof json !== 'object') return;
    const rawError = json.response?.error?.message || json.error?.message || json.error;
    if (typeof rawError === 'string' && rawError) error = rawError;

    const type = typeof json.type === 'string' ? json.type : '';
    if (type === 'response.output_text.delta') {
      if (typeof json.delta === 'string' && json.delta) {
        content += json.delta;
        sawTextDelta = true;
        onDelta?.({ type: 'content', text: json.delta });
      }
      return;
    }
    if (type === 'response.reasoning_summary_text.delta' || type === 'response.reasoning_text.delta') {
      if (typeof json.delta === 'string' && json.delta) reasoning += json.delta;
      return;
    }
    if (type === 'response.output_item.added' && json.item?.type === 'function_call') {
      announceTools();
      const slot = slotAt(json.output_index);
      const item = json.item;
      if (item.call_id || item.id) slot.id = String(item.call_id || item.id);
      if (item.name) slot.name = String(item.name);
      if (typeof item.arguments === 'string' && item.arguments && !slot.arguments) slot.arguments = item.arguments;
      return;
    }
    if (type === 'response.function_call_arguments.delta') {
      announceTools();
      const slot = slotAt(json.output_index);
      if (json.item_id && !slot.id) slot.id = String(json.item_id);
      if (typeof json.delta === 'string') slot.arguments += json.delta;
      return;
    }
    if (type === 'response.function_call_arguments.done') {
      const slot = slotAt(json.output_index);
      if (typeof json.arguments === 'string' && json.arguments) slot.arguments = json.arguments;
      return;
    }
    if (type === 'error' || type === 'response.failed') return;
    if (type === 'response.completed' || type === 'response.incomplete' || json.object === 'response' || Array.isArray(json.output)) {
      applyCompleted(json.response || json);
    }
  }

  /**
   * @param {any} response
   */
  function applyCompleted(response) {
    const parsed = readResponsesOutput(response);
    if (!sawTextDelta && parsed.content && !content) {
      content = parsed.content;
      onDelta?.({ type: 'content', text: parsed.content });
    }
    if (!reasoning && parsed.reasoning) reasoning = parsed.reasoning;
    if (!calls.some((call) => call.name) && parsed.toolCalls.length) {
      announceTools();
      for (const call of parsed.toolCalls) {
        calls.push({
          id: call.id,
          name: call.name,
          arguments: JSON.stringify(call.arguments ?? {})
        });
      }
    }
  }

  function takeLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    sawSse = true;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      consume(JSON.parse(data));
    } catch {
      error = error || '模型返回无法解析';
    }
  }

  return {
    /** @param {string} chunk */
    push(chunk) {
      raw += chunk;
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) takeLine(line);
    },
    finish() {
      if (buffer.trim()) takeLine(buffer);
      buffer = '';
      if (!sawSse && raw.trim()) {
        try {
          consume(JSON.parse(raw));
        } catch {
          error = error || '模型返回无法解析';
        }
      }
      const toolCalls = calls.map((call, index) => ({
        id: call.id || `call-${index}`,
        name: call.name,
        arguments: parseArguments(call.arguments)
      })).filter((call) => call.name);
      return { content, reasoning: reasoning.trim(), toolCalls, error };
    }
  };
}
