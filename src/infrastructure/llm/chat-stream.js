/**
 * 把模型的流式输出收成正文、思考和工具调用。
 * 工具参数只留在结果里，不通过 onDelta 送出。
 */

/**
 * @param {(delta: { type: 'content', text: string } | { type: 'tools' }) => void} [onDelta]
 */
export function createChatStream(onDelta) {
  let raw = '';
  let buffer = '';
  let sawSse = false;
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
   * @param {any} json
   */
  function consume(json) {
    if (!json || typeof json !== 'object') return;
    const rawError = json.error?.message || json.error;
    if (typeof rawError === 'string' && rawError) error = rawError;
    const choice = Array.isArray(json.choices) ? json.choices[0] : null;
    if (!choice) return;
    if (choice.delta) applyDelta(choice.delta);
    if (choice.message) applyMessage(choice.message);
  }

  /**
   * @param {any} delta
   */
  function applyDelta(delta) {
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      onDelta?.({ type: 'content', text: delta.content });
    }
    const thought = delta.reasoning_content ?? delta.reasoning;
    if (typeof thought === 'string' && thought) reasoning += thought;
    if (Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
      announceTools();
      for (const call of delta.tool_calls) {
        const index = Number.isInteger(call?.index) ? call.index : 0;
        while (calls.length <= index) calls.push({ id: '', name: '', arguments: '' });
        const slot = calls[index];
        if (call?.id) slot.id = String(call.id);
        const name = call?.function?.name;
        const args = call?.function?.arguments;
        if (typeof name === 'string' && name) slot.name += name;
        if (typeof args === 'string') slot.arguments += args;
      }
    }
  }

  /**
   * @param {any} message
   */
  function applyMessage(message) {
    if (typeof message.content === 'string' && message.content && !content) {
      content = message.content;
      onDelta?.({ type: 'content', text: message.content });
    }
    const thought = message.reasoning_content ?? message.reasoning;
    if (typeof thought === 'string' && thought && !reasoning) reasoning = thought;
    if (Array.isArray(message.tool_calls) && message.tool_calls.length && !calls.length) {
      announceTools();
      for (const call of message.tool_calls) {
        const args = call?.function?.arguments;
        calls.push({
          id: String(call?.id || ''),
          name: String(call?.function?.name || ''),
          arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {})
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

/**
 * @param {string} raw
 */
function parseArguments(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
