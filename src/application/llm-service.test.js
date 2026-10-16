import { describe, expect, it } from 'vitest';
import { EventBus } from './event-bus.js';
import { LlmService } from './llm-service.js';

function service(settings, chat, log) {
  return new LlmService({
    settingsRepo: { load: () => settings, save: (next) => next },
    eventBus: new EventBus(),
    chat,
    log
  });
}

describe('LlmService model slots', () => {
  it('uses a filled row and otherwise the default model', async () => {
    let seen = null;
    const chat = async (input) => {
      seen = input;
      return 'OK';
    };
    const filled = service({
      baseUrl: 'https://example.com/v1',
      fullUrl: false,
      apiKey: 'k',
      model: 'default-model',
      breakdownModel: 'break-model'
    }, chat);
    await filled.complete({ slot: 'breakdownModel', user: '拆' });
    expect(seen.model).toBe('break-model');

    await filled.complete({ slot: 'agentModel', user: '报' });
    expect(seen.model).toBe('default-model');
    expect(filled.modelFor('agentModel')).toBe('default-model');
  });

  it('tests the connection with the default model only', async () => {
    let seen = null;
    const llm = service({
      baseUrl: 'https://example.com/v1',
      fullUrl: false,
      apiKey: 'k',
      model: '',
      tagModel: 'tiny'
    }, async (input) => {
      seen = input;
      return 'OK';
    });
    await expect(llm.testConnection()).rejects.toThrow('请先在设置中填写默认模型');
    expect(seen).toBeNull();
  });

  it('does not replace an empty conversation model with the current default', async () => {
    const llm = service({
      baseUrl: 'https://example.com/v1',
      fullUrl: false,
      apiKey: 'k',
      model: 'default-model',
      agentModel: 'agent-model'
    }, async () => 'OK');
    await expect(llm.completeWithTools({ messages: [], tools: [], model: '' })).rejects.toThrow('请先在设置中填写默认模型');
  });

  it('writes the prompt and reply to the model log without the key', async () => {
    const entries = [];
    const llm = service({
      baseUrl: 'https://example.com/v1',
      fullUrl: false,
      apiKey: 'secret-key',
      model: 'default-model',
      tagModel: 'tag-model'
    }, async () => '项目名', async (record) => { entries.push(record); });
    await expect(llm.complete({ slot: 'tagModel', system: '只输出 JSON', user: '任务名称：写日志' })).resolves.toBe('项目名');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'model_call',
      provider: 'chat',
      slot: 'tagModel',
      model: 'tag-model',
      ok: true,
      request: { system: '只输出 JSON', user: '任务名称：写日志' },
      response: '项目名'
    });
    expect(JSON.stringify(entries[0])).not.toContain('secret-key');
  });

  it('records a failed completion and still throws', async () => {
    const entries = [];
    const llm = service({
      baseUrl: 'https://example.com/v1',
      fullUrl: false,
      apiKey: 'secret-key',
      model: 'default-model'
    }, async () => { throw new Error('HTTP 401'); }, async (record) => { entries.push(record); });
    await expect(llm.complete({ user: '报' })).rejects.toThrow('HTTP 401');
    expect(entries[0]).toMatchObject({ ok: false, error: 'HTTP 401', slot: 'model' });
    expect(JSON.stringify(entries[0])).not.toContain('secret-key');
  });

  it('records only the outcome of a tool call', async () => {
    const entries = [];
    const llm = new LlmService({
      settingsRepo: {
        load: () => ({
          baseUrl: 'https://example.com/v1',
          fullUrl: false,
          apiKey: 'secret-key',
          model: 'default-model'
        }),
        save: (next) => next
      },
      eventBus: new EventBus(),
      log: async (record) => { entries.push(record); }
    });
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '好', tool_calls: [] } }] })
    });
    try {
      await llm.completeWithTools({
        model: 'agent-model',
        messages: [{ role: 'user', content: '很长的对话' }],
        tools: []
      });
    } finally {
      globalThis.fetch = original;
    }
    expect(entries[0]).toMatchObject({ provider: 'chat', slot: 'agent', model: 'agent-model', ok: true });
    expect(entries[0].request).toBeUndefined();
    expect(JSON.stringify(entries[0])).not.toContain('很长的对话');
    expect(JSON.stringify(entries[0])).not.toContain('secret-key');
  });
});
