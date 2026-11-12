import { describe, expect, it } from 'vitest';
import { createChatStream } from './chat-stream.js';

describe('createChatStream', () => {
  it('appends split content and keeps tool arguments out of the deltas', () => {
    /** @type {any[]} */
    const deltas = [];
    const stream = createChatStream((delta) => deltas.push(delta));
    stream.push('data: {"type":"response.output_text.delta","delta":"你"}\n');
    stream.push('data: {"type":"response.output_text.delta","delta":"好"}\n\n');
    stream.push('data: {"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","call_id":"call-1","name":"list_tags","arguments":""}}\n\n');
    stream.push('data: {"type":"response.function_call_arguments.delta","output_index":1,"delta":"{\\"a\\":1}"}\n\n');
    stream.push('data: {"type":"response.completed","response":{"output_text":"你好"}}\n\n');
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
      object: 'response',
      output_text: '好。',
      output: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: '先看' }] },
        { type: 'message', content: [{ type: 'output_text', text: '好。' }] }
      ]
    }));
    const result = stream.finish();
    expect(deltas).toEqual([{ type: 'content', text: '好。' }]);
    expect(result.reasoning).toBe('先看');
    expect(result.content).toBe('好。');
  });
});
