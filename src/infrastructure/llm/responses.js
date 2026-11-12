/**
 * OpenAI Responses 请求与结果。
 * 应用内部仍用 system / user / assistant / tool 消息，发出前改成 input。
 */

/** @param {string} address @param {boolean} fullUrl */
export function responsesUrl(address, fullUrl) {
  const trimmed = String(address || '').trim();
  if (!trimmed) return '';
  if (fullUrl) return trimmed;
  return `${trimmed.replace(/\/$/, '')}/responses`;
}

/** @param {string} address @param {boolean} fullUrl */
export function modelsUrl(address, fullUrl) {
  const trimmed = String(address || '').trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (!fullUrl) return `${trimmed}/models`;
  const base = trimmed
    .replace(/\/responses$/i, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '');
  return `${base}/models`;
}

/**
 * @param {any} tool
 */
export function toResponsesTool(tool) {
  const fn = tool?.function;
  if (!fn) return tool;
  return {
    type: 'function',
    name: fn.name,
    description: fn.description || '',
    parameters: fn.parameters || { type: 'object', properties: {} }
  };
}

/** @param {any} content */
function textContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
}

/**
 * @param {object} input
 * @param {string} input.model
 * @param {string} [input.system]
 * @param {string} [input.user]
 * @param {any[]} [input.messages]
 * @param {any[]} [input.tools]
 * @param {number} [input.maxTokens]
 * @param {boolean} [input.stream]
 */
export function toResponsesBody({ model, system, user, messages, tools, maxTokens, stream }) {
  /** @type {string[]} */
  const instructions = [];
  /** @type {any[]} */
  const input = [];
  if (system) instructions.push(String(system));
  if (user) input.push({ role: 'user', content: String(user) });

  for (const message of messages || []) {
    if (!message) continue;
    if (message.role === 'system' || message.role === 'developer') {
      const text = textContent(message.content);
      if (text) instructions.push(text);
      continue;
    }
    if (message.role === 'tool') {
      const output = typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '');
      input.push({
        type: 'function_call_output',
        call_id: String(message.tool_call_id || ''),
        output
      });
      continue;
    }
    if (message.role === 'assistant') {
      const text = textContent(message.content);
      if (text) {
        input.push({
          role: 'assistant',
          content: [{ type: 'output_text', text }]
        });
      }
      for (const call of message.tool_calls || []) {
        const args = call?.function?.arguments ?? call?.arguments ?? {};
        input.push({
          type: 'function_call',
          call_id: String(call?.id || call?.call_id || ''),
          name: String(call?.function?.name || call?.name || ''),
          arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {})
        });
      }
      continue;
    }
    if (message.role === 'user') {
      input.push({ role: 'user', content: textContent(message.content) });
    }
  }

  /** @type {Record<string, any>} */
  const body = { model, input };
  const instructionText = instructions.filter(Boolean).join('\n\n');
  if (instructionText) body.instructions = instructionText;
  if (Array.isArray(tools) && tools.length) body.tools = tools.map(toResponsesTool);
  if (maxTokens) body.max_output_tokens = maxTokens;
  if (stream) body.stream = true;
  return body;
}

/**
 * @param {string} raw
 */
export function parseArguments(raw) {
  if (!raw || !String(raw).trim()) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/**
 * @param {any} data
 * @returns {{ content: string, reasoning: string, toolCalls: { id: string, name: string, arguments: any }[] }}
 */
export function readResponsesOutput(data) {
  const output = Array.isArray(data?.output) ? data.output : [];
  let content = typeof data?.output_text === 'string' ? data.output_text.trim() : '';
  let reasoning = '';
  /** @type {{ id: string, name: string, arguments: any }[]} */
  const toolCalls = [];

  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'message' && !content) {
      const text = textContent(item.content).trim();
      if (text) content = text;
    } else if (item.type === 'function_call') {
      toolCalls.push({
        id: String(item.call_id || item.id || `call-${toolCalls.length}`),
        name: String(item.name || ''),
        arguments: parseArguments(typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments ?? {}))
      });
    } else if (item.type === 'reasoning') {
      const summary = textContent(item.summary);
      const text = textContent(item.content);
      reasoning += summary || text;
    }
  }

  return {
    content,
    reasoning: reasoning.trim(),
    toolCalls: toolCalls.filter((call) => call.name)
  };
}
