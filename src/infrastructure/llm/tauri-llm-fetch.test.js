import { describe, expect, it } from 'vitest';
import { llmTransport } from './tauri-llm-fetch.js';

describe('llmTransport', () => {
  it('uses page fetch outside the desktop app', async () => {
    const response = await llmTransport('https://example.com/v1/models', { method: 'GET' }, {
      inTauri: false,
      fetchImpl: async (url, init) => {
        expect(url).toBe('https://example.com/v1/models');
        expect(init.method).toBe('GET');
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      }
    });
    expect(response.ok).toBe(true);
  });

  it('asks the desktop app to perform the request', async () => {
    const response = await llmTransport('https://example.com/v1/models', {
      method: 'GET',
      headers: { Authorization: 'Bearer sk-test' }
    }, {
      inTauri: true,
      invoke: async (command, args) => {
        expect(command).toBe('llm_http');
        expect(args).toEqual({
          method: 'GET',
          url: 'https://example.com/v1/models',
          headers: { Authorization: 'Bearer sk-test' },
          body: null
        });
        return { status: 200, body: '{"data":[{"id":"demo"}]}' };
      }
    });
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [{ id: 'demo' }] });
  });

  it('surfaces a desktop request failure as an error message', async () => {
    await expect(llmTransport('https://example.com/v1/models', {}, {
      inTauri: true,
      invoke: async () => {
        throw '连不上模型服务，请检查请求地址和网络';
      }
    })).rejects.toThrow('连不上模型服务，请检查请求地址和网络');
  });
});
