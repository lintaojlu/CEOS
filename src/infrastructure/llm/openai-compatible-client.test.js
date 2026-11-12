import { describe, expect, it } from 'vitest';
import { chatCompletion, chatCompletionWithTools, modelsUrl, responsesUrl, streamChatCompletionWithTools } from './openai-compatible-client.js';
import { DEFAULT_JEV_BASE_URL, DEFAULT_JEV_MODEL, normalizeLlmSettings, resolveJevModel } from '../storage/llm-settings-repository.js';

describe('responses urls', () => {
  it('appends responses and models to a base endpoint', () => {
    expect(responsesUrl('https://api.openai.com/v1/', false)).toBe('https://api.openai.com/v1/responses');
    expect(modelsUrl('https://api.openai.com/v1/', false)).toBe('https://api.openai.com/v1/models');
  });

  it('uses a full request url as-is and derives the models url', () => {
    expect(responsesUrl('https://api.openai.com/v1/responses', true)).toBe('https://api.openai.com/v1/responses');
    expect(modelsUrl('https://api.openai.com/v1/responses', true)).toBe('https://api.openai.com/v1/models');
    expect(modelsUrl('https://api.openai.com/v1/chat/completions', true)).toBe('https://api.openai.com/v1/models');
  });
});

describe('chatCompletion', () => {
  it('reads a responses stream instead of a single JSON body', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"type":"response.output_text.delta","delta":"{\\"description\\":\\"和空间折叠有关\\"}"}\n\n'
    ];
    const text = await chatCompletion({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'demo',
      system: '只输出 JSON',
      user: '写描述',
      maxTokens: 200,
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        expect(url).toBe('https://example.com/v1/responses');
        expect(body.stream).toBe(true);
        expect(body.thinking).toBeUndefined();
        expect(body.max_output_tokens).toBe(200);
        expect(body.instructions).toBe('只输出 JSON');
        expect(body.input).toEqual([{ role: 'user', content: '写描述' }]);
        let index = 0;
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              return {
                async read() {
                  if (index >= chunks.length) return { done: true, value: undefined };
                  const value = encoder.encode(chunks[index]);
                  index += 1;
                  return { done: false, value };
                },
                async cancel() {}
              };
            }
          }
        };
      }
    });
    expect(text).toBe('{"description":"和空间折叠有关"}');
  });
});

describe('chatCompletionWithTools', () => {
  it('returns tool calls without requiring text', async () => {
    const result = await chatCompletionWithTools({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'demo',
      messages: [
        { role: 'system', content: '规则' },
        { role: 'user', content: '今天' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'list_tags', arguments: '{}' } }]
        },
        { role: 'tool', tool_call_id: 'call-1', content: '{"tags":[]}' }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'list_tags',
          description: '列出标签',
          parameters: { type: 'object', properties: {} }
        }
      }],
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        expect(url).toBe('https://example.com/v1/responses');
        expect(body.messages).toBeUndefined();
        expect(body.input).toEqual([
          { role: 'user', content: '今天' },
          {
            type: 'function_call',
            call_id: 'call-1',
            name: 'list_tags',
            arguments: '{}'
          },
          { type: 'function_call_output', call_id: 'call-1', output: '{"tags":[]}' }
        ]);
        expect(body.instructions).toBe('规则');
        expect(body.tools).toEqual([{
          type: 'function',
          name: 'list_tags',
          description: '列出标签',
          parameters: { type: 'object', properties: {} }
        }]);
        expect(init.headers.Authorization).toBe('Bearer sk-test');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output: [{
              type: 'function_call',
              call_id: 'call-1',
              name: 'list_tags',
              arguments: '{}'
            }]
          })
        };
      }
    });
    expect(result.content).toBe('');
    expect(result.reasoning).toBe('');
    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'list_tags', arguments: {} }]);
  });

  it('reads reasoning when the model sends it', async () => {
    const result = await chatCompletionWithTools({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'demo',
      messages: [],
      tools: [],
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          output_text: '好。',
          output: [
            { type: 'reasoning', summary: [{ type: 'summary_text', text: '先看今天' }] },
            { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '好。' }] }
          ]
        })
      })
    });
    expect(result.reasoning).toBe('先看今天');
    expect(result.content).toBe('好。');
  });
});

describe('streamChatCompletionWithTools', () => {
  it('emits content as each event arrives', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"type":"response.output_text.delta","delta":"今"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"天"}\n\n',
      'data: {"type":"response.completed","response":{"output_text":"今天","output":[]}}\n\n'
    ];
    /** @type {string[]} */
    const seen = [];
    const result = await streamChatCompletionWithTools({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'demo',
      messages: [],
      tools: [],
      onDelta: (delta) => { if (delta.type === 'content') seen.push(delta.text); },
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        expect(body.stream).toBe(true);
        let index = 0;
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              return {
                async read() {
                  if (index >= chunks.length) return { done: true, value: undefined };
                  const value = encoder.encode(chunks[index]);
                  index += 1;
                  return { done: false, value };
                },
                async cancel() {}
              };
            }
          }
        };
      }
    });
    expect(seen).toEqual(['今', '天']);
    expect(result.content).toBe('今天');
    expect(result.toolCalls).toEqual([]);
  });
});

describe('normalizeLlmSettings', () => {
  it('keeps the full-url flag and still defaults the endpoint', () => {
    expect(normalizeLlmSettings({}).fullUrl).toBe(false);
    expect(normalizeLlmSettings({ fullUrl: true, baseUrl: 'https://example.com/v1/chat/completions' })).toEqual({
      baseUrl: 'https://example.com/v1/chat/completions',
      fullUrl: true,
      apiKey: '',
      model: '',
      agentModel: '',
      breakdownModel: '',
      tagModel: '',
      standardizeModel: '',
      jevApiKey: '',
      jevBaseUrl: DEFAULT_JEV_BASE_URL,
      jevModel: ''
    });
  });

  it('keeps a previously saved small model as the tag model', () => {
    expect(normalizeLlmSettings({ model: 'big', smallModel: 'tiny' })).toMatchObject({
      model: 'big',
      tagModel: 'tiny',
      agentModel: '',
      breakdownModel: '',
      standardizeModel: '',
      jevApiKey: '',
      jevBaseUrl: DEFAULT_JEV_BASE_URL,
      jevModel: ''
    });
    expect(normalizeLlmSettings({ model: 'big', smallModel: 'tiny', tagModel: 'kept' }).tagModel).toBe('kept');
    expect(resolveJevModel({ model: 'big', jevModel: '' })).toBe(DEFAULT_JEV_MODEL);
    expect(resolveJevModel({ model: 'big', jevModel: 'jev-1.14.0' })).toBe('jev-1.14.0');
  });
});
