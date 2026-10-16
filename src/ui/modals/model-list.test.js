import { describe, expect, it } from 'vitest';
import { groupModelIds } from './model-list.js';

describe('groupModelIds', () => {
  const ids = [
    'plain-model',
    'alibaba/wan3.0-video',
    'alibaba/wan3.0-video-prime',
    'anthropic/claude-haiku-4.5'
  ];

  it('groups ids by the provider before the slash and keeps order', () => {
    expect(groupModelIds(ids)).toEqual({
      ungrouped: ['plain-model'],
      groups: [
        { label: 'alibaba', ids: ['alibaba/wan3.0-video', 'alibaba/wan3.0-video-prime'] },
        { label: 'anthropic', ids: ['anthropic/claude-haiku-4.5'] }
      ]
    });
  });

  it('filters by a case-insensitive substring and drops empty groups', () => {
    expect(groupModelIds(ids, 'HAIKU')).toEqual({
      ungrouped: [],
      groups: [{ label: 'anthropic', ids: ['anthropic/claude-haiku-4.5'] }]
    });
  });
});
