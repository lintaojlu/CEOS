import { describe, it, expect } from 'vitest';
import { parseProjectTitle, formatProjectTaskTitle } from './project-title.js';

describe('parseProjectTitle', () => {
  it('parses 【项目名】任务标题', () => {
    expect(parseProjectTitle('【CEOS】写计划')).toEqual({ name: 'CEOS', text: '写计划' });
  });

  it('trims the name and the title', () => {
    expect(parseProjectTitle('  【 CEOS 】  写计划  ')).toEqual({ name: 'CEOS', text: '写计划' });
  });

  it('returns null without a prefix, with an empty title, or with a missing bracket', () => {
    expect(parseProjectTitle('写计划')).toBe(null);
    expect(parseProjectTitle('【CEOS】')).toBe(null);
    expect(parseProjectTitle('【CEOS】   ')).toBe(null);
    expect(parseProjectTitle('【CEOS写计划')).toBe(null);
    expect(parseProjectTitle('CEOS】写计划')).toBe(null);
  });
});

describe('formatProjectTaskTitle', () => {
  it('joins name and title', () => {
    expect(formatProjectTaskTitle('CEOS', '写计划')).toBe('【CEOS】写计划');
  });
});
