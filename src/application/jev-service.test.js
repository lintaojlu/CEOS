import { describe, expect, it } from 'vitest';
import { JevService } from './jev-service.js';

function service(settings, evaluate, log) {
  return new JevService({
    settingsRepo: { load: () => settings },
    evaluate,
    log
  });
}

const settings = {
  jevApiKey: 'jev-secret',
  jevBaseUrl: 'https://api.typesafe.ai/v1',
  jevModel: 'jev-latest'
};

describe('JevService logs', () => {
  it('records a skip when the key is empty and does not call', async () => {
    const entries = [];
    let called = false;
    const jev = service(
      { ...settings, jevApiKey: '' },
      async () => { called = true; return {}; },
      async (record) => { entries.push(record); }
    );
    await expect(jev.decide({ title: '写日志' })).resolves.toEqual({ standardize: false, breakdown: false });
    expect(called).toBe(false);
    expect(entries[0]).toMatchObject({ provider: 'jev', skipped: 'no-key', ok: false });
    expect(JSON.stringify(entries[0])).not.toContain('jev-secret');
  });

  it('records noul answers without the key', async () => {
    const entries = [];
    const jev = service(settings, async () => ({
      answers: {
        standardize: { type: 'noul', noul: 0.8 },
        breakdown: { type: 'noul', noul: 0.2 }
      }
    }), async (record) => { entries.push(record); });
    await expect(jev.decide({ title: '拆解 okr' })).resolves.toEqual({ standardize: true, breakdown: false });
    expect(entries[0]).toMatchObject({
      provider: 'jev',
      model: 'jev-latest',
      ok: true,
      response: {
        standardize: { type: 'noul', noul: 0.8 },
        breakdown: { type: 'noul', noul: 0.2 }
      },
      decision: { standardize: true, breakdown: false }
    });
    expect(entries[0].request.state.title).toBe('拆解 okr');
    expect(JSON.stringify(entries[0])).not.toContain('jev-secret');
  });

  it('records a failed request and still throws', async () => {
    const entries = [];
    const jev = service(
      settings,
      async () => { throw new Error('HTTP 403'); },
      async (record) => { entries.push(record); }
    );
    await expect(jev.decide({ title: 'x' })).rejects.toThrow('HTTP 403');
    expect(entries[0]).toMatchObject({ ok: false, error: 'HTTP 403' });
    expect(JSON.stringify(entries[0])).not.toContain('jev-secret');
  });
});
