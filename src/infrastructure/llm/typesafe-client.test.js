import { describe, expect, it } from 'vitest';
import { LlmRequestError } from './openai-compatible-client.js';
import { evaluateSystemOne, listSystemOneModels, systemOneModelsUrl, systemOneUrl } from './typesafe-client.js';
import { JEV_QUESTIONS } from '../../domain/schedule/task-jev.js';

describe('system one urls', () => {
  it('appends systemone and models to the base', () => {
    expect(systemOneUrl('https://api.typesafe.ai/v1/')).toBe('https://api.typesafe.ai/v1/systemone');
    expect(systemOneModelsUrl('https://api.typesafe.ai/v1')).toBe('https://api.typesafe.ai/v1/models');
    expect(systemOneUrl('')).toBe('');
  });
});

describe('evaluateSystemOne', () => {
  it('posts the text state and both questions once', async () => {
    let seen = null;
    const state = { title: '买菜', notes: [], projects: ['生活'] };
    const result = await evaluateSystemOne({
      baseUrl: 'https://api.typesafe.ai/v1',
      apiKey: 'ts-key',
      model: 'jev-latest',
      state,
      questions: JEV_QUESTIONS,
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              model: 'jev-1.13.0',
              answers: {
                standardize: { type: 'noul', noul: 0.2 },
                breakdown: { type: 'noul', noul: 0.8 }
              }
            };
          }
        };
      }
    });
    expect(seen.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(seen.init.method).toBe('POST');
    expect(seen.init.headers.Authorization).toBe('Bearer ts-key');
    expect(JSON.parse(seen.init.body)).toEqual({
      model: 'jev-latest',
      state,
      questions: JEV_QUESTIONS
    });
    expect(result.answers.breakdown.noul).toBe(0.8);
  });

  it('does not call the network without a key', async () => {
    let called = false;
    await expect(evaluateSystemOne({
      baseUrl: 'https://api.typesafe.ai/v1',
      apiKey: '',
      model: 'jev-latest',
      state: { title: '买菜' },
      questions: JEV_QUESTIONS,
      fetchImpl: async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; }
    })).rejects.toThrow('请先在设置中填写 JEV 的 API Key');
    expect(called).toBe(false);
  });

  it('surfaces the service error', async () => {
    await expect(evaluateSystemOne({
      baseUrl: 'https://api.typesafe.ai/v1',
      apiKey: 'ts-key',
      model: 'jev-latest',
      state: { title: '买菜' },
      questions: JEV_QUESTIONS,
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        async json() { return { error: { message: 'invalid api key' } }; }
      })
    })).rejects.toMatchObject({ message: 'invalid api key', code: 'http' });
  });
});

describe('listSystemOneModels', () => {
  it('reads model names', async () => {
    const ids = await listSystemOneModels({
      baseUrl: 'https://api.typesafe.ai/v1',
      apiKey: 'ts-key',
      fetchImpl: async (url) => {
        expect(url).toBe('https://api.typesafe.ai/v1/models');
        return {
          ok: true,
          status: 200,
          async json() {
            return { models: [{ name: 'jev-latest' }, { name: 'jev-preview' }, { name: 'jev-latest' }] };
          }
        };
      }
    });
    expect(ids).toEqual(['jev-latest', 'jev-preview']);
  });

  it('requires a key', async () => {
    await expect(listSystemOneModels({
      baseUrl: 'https://api.typesafe.ai/v1',
      apiKey: '',
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) })
    })).rejects.toBeInstanceOf(LlmRequestError);
  });
});
