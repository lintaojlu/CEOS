import { describe, expect, it } from 'vitest';
import { SETTINGS_GROUPS, filterSettingsGroups } from './settings-nav.js';

describe('filterSettingsGroups', () => {
  it('keeps every group for an empty query', () => {
    expect(filterSettingsGroups('  ')).toBe(SETTINGS_GROUPS);
  });

  it('matches labels and hidden keywords, and drops empty groups', () => {
    expect(filterSettingsGroups('归档').map((group) => group.items.map((item) => item.id))).toEqual([['data']]);
    expect(filterSettingsGroups('jev').map((group) => group.items.map((item) => item.id))).toEqual([['jev']]);
    expect(filterSettingsGroups('key').flatMap((group) => group.items.map((item) => item.id))).toEqual(['model', 'jev']);
    expect(filterSettingsGroups('没有这个')).toEqual([]);
  });
});
