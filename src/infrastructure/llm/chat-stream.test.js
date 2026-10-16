import { describe, expect, it } from 'vitest';
import { createChatStream } from './chat-stream.js';

describe('createChatStream', () => {
  it('appends split content and keeps tool arguments out of the deltas', () => {
    /** @type {any[]} */
    const deltas = [];
    const stream = createChatStream((delta) => deltas.push(delta));
    stream.push('data: {"choices":[{"delta":{"content":"你"}}]}\n');
    stream.push('data: {"choices":[{"delta":{"content":"好"}}]}\n\n');
    stream.push('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"list_tags","arguments":""}}]}}]}\n\n');
    stream.push('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"a\\":1}"}}]}}]}\n\n');
    stream.push('data: [DONE]\n\n');
    expect(deltas).toEqual([
      { type: 'content', text: '你' },
      { type: 'content', text: '好' },
      { type: 'tools' }
    ]);
    expect(stream.finish()).toMatchObject({
      content: '你好',
      toolCalls: [{ id: 'call-1', name: 'list_tags', arguments: { a: 1 } }]
    });
  });

  it('reads a non-stream JSON body once', () => {
    /** @type {any[]} */
    const deltas = [];
    const stream = createChatStream((delta) => deltas.push(delta));
    stream.push(JSON.stringify({
      choices: [{ message: { content: '好。', reasoning_content: '先看', tool_calls: [] } }]
    }));
    const result = stream.finish();
    expect(deltas).toEqual([{ type: 'content', text: '好。' }]);
    expect(result.reasoning).toBe('先看');
    expect(result.content).toBe('好。');
  });
});
