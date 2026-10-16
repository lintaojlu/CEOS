import { describe, expect, it } from 'vitest';
import { chatCompletionWithTools, chatCompletionsUrl, modelsUrl, streamChatCompletionWithTools } from './openai-compatible-client.js';
import { DEFAULT_JEV_BASE_URL, DEFAULT_JEV_MODEL, normalizeLlmSettings, resolveJevModel } from '../storage/llm-settings-repository.js';

describe('openai compatible urls', () => {
  it('appends chat/completions and models to a base endpoint', () => {
    expect(chatCompletionsUrl('https://api.openai.com/v1/', false)).toBe('https://api.openai.com/v1/chat/completions');
    expect(modelsUrl('https://api.openai.com/v1/', false)).toBe('https://api.openai.com/v1/models');
  });

  it('uses a full request url as-is and derives the models url', () => {
    expect(chatCompletionsUrl('https://api.openai.com/v1/chat/completions', true)).toBe('https://api.openai.com/v1/chat/completions');
    expect(modelsUrl('https://api.openai.com/v1/chat/completions', true)).toBe('https://api.openai.com/v1/models');
  });
});

describe('chatCompletionWithTools', () => {
  it('returns tool calls without requiring text', async () => {
    const result = await chatCompletionWithTools({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'demo',
      messages: [],
      tools: [],
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        expect(body.tools).toEqual([]);
        expect(init.headers.Authorization).toBe('Bearer sk-test');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                content: null,
                tool_calls: [{ id: 'call-1', function: { name: 'list_tags', arguments: '{}' } }]
              }
            }]
          })
        };
      }
    });
    expect(result.content).toBe('');
    expect(result.reasoning).toBe('');
    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'list_tags', arguments: {} }]);
  });

  it('reads reasoning_content when the model sends it', async () => {
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
          choices: [{
            message: {
              content: '好。',
              reasoning_content: '先看今天',
              tool_calls: []
            }
          }]
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
      'data: {"choices":[{"delta":{"content":"今"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"天"}}]}\n\n',
      'data: [DONE]\n\n'
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
