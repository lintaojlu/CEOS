import { describe, expect, it } from 'vitest';
import { recordModelCall } from './model-log.js';

describe('recordModelCall', () => {
  it('drops the key and bearer token before writing', async () => {
    const entries = [];
    await recordModelCall(async (record) => { entries.push(record); }, {
      provider: 'chat',
      apiKey: 'secret-key',
      request: { user: 'Authorization: Bearer secret-key' }
    });
    expect(entries[0].kind).toBe('model_call');
    expect(entries[0].apiKey).toBeUndefined();
    expect(entries[0].request.user).toBe('Authorization: Bearer [redacted]');
    expect(JSON.stringify(entries[0])).not.toContain('secret-key');
  });
});
