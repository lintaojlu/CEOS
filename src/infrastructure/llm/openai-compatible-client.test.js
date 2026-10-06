import { describe, expect, it } from 'vitest';
import { chatCompletionsUrl, modelsUrl } from './openai-compatible-client.js';
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
