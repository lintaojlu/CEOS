import { describe, expect, it } from 'vitest';
import { ideaListDate } from './idea-list-date.js';

const now = new Date(2026, 9, 16, 18, 0, 0);

describe('ideaListDate', () => {
  it('labels today and yesterday, and writes other days as month and day', () => {
    expect(ideaListDate(new Date(2026, 9, 16, 1, 0, 0).getTime(), now)).toBe('今天');
    expect(ideaListDate(new Date(2026, 9, 15, 23, 0, 0).getTime(), now)).toBe('昨天');
    expect(ideaListDate(new Date(2026, 8, 22, 12, 0, 0).getTime(), now)).toBe('9月22日');
    expect(ideaListDate(new Date(2026, 9, 2, 12, 0, 0).getTime(), now)).toBe('10月2日');
    expect(ideaListDate(new Date(2026, 8, 4, 12, 0, 0).getTime(), now)).toBe('9月4日');
  });
});
