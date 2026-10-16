import { describe, expect, it } from 'vitest';
import { chatCompletionWithTools, chatCompletionsUrl, modelsUrl } from './openai-compatible-client.js';
import { normalizeLlmSettings } from '../storage/llm-settings-repository.js';

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

describe('normalizeLlmSettings', () => {
  it('keeps the full-url flag and still defaults the endpoint', () => {
    expect(normalizeLlmSettings({}).fullUrl).toBe(false);
    expect(normalizeLlmSettings({ fullUrl: true, baseUrl: 'https://example.com/v1/chat/completions' })).toEqual({
      baseUrl: 'https://example.com/v1/chat/completions',
      fullUrl: true,
      apiKey: '',
      model: ''
    });
  });
});
