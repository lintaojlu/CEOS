import { describe, expect, it } from 'vitest';
import { ideaListDate } from './idea-list-date.js';

describe('ideaListDate', () => {
  it('writes the day as month, day, and two-digit year', () => {
    expect(ideaListDate(new Date(2026, 9, 19, 14, 47, 0).getTime())).toBe('10/19/26');
    expect(ideaListDate(new Date(2026, 9, 16, 1, 0, 0).getTime())).toBe('10/16/26');
    expect(ideaListDate(new Date(2026, 8, 22, 12, 0, 0).getTime())).toBe('9/22/26');
    expect(ideaListDate(new Date(2026, 9, 2, 12, 0, 0).getTime())).toBe('10/2/26');
    expect(ideaListDate(new Date(2026, 8, 4, 12, 0, 0).getTime())).toBe('9/4/26');
  });
});
