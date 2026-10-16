import { describe, expect, it } from 'vitest';
import { readSecret, secretsToSave } from './secret-field.js';

describe('secretsToSave', () => {
  it('keeps the key read when the button was pressed, even if the field is empty afterwards', () => {
    expect(secretsToSave(
      { apiKey: 'chat-key', jevApiKey: 'jev-key' },
      { apiKey: '', jevApiKey: '' }
    )).toEqual({ apiKey: 'chat-key', jevApiKey: 'jev-key' });
  });

  it('keeps an intentional clear made before the press', () => {
    expect(secretsToSave(
      { apiKey: 'chat-key', jevApiKey: '' },
      { apiKey: 'chat-key', jevApiKey: 'stale' }
    )).toEqual({ apiKey: 'chat-key', jevApiKey: '' });
  });

  it('reads the fields when nothing was pressed', () => {
    expect(secretsToSave(null, { apiKey: 'chat-key', jevApiKey: 'jev-key' }))
      .toEqual({ apiKey: 'chat-key', jevApiKey: 'jev-key' });
  });
});

describe('readSecret', () => {
  it('reads the input, including an empty box', () => {
    expect(readSecret({ value: 'jev-key' }, '')).toBe('jev-key');
    expect(readSecret({ value: '' }, 'stale')).toBe('');
  });

  it('uses the fallback when the input is not mounted', () => {
    expect(readSecret(null, 'from-state')).toBe('from-state');
  });
});
