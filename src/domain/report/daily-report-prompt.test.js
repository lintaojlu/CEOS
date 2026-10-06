import { describe, expect, it } from 'vitest';
import { buildDailyReportPrompt, formatBullets } from './daily-report-prompt.js';

describe('buildDailyReportPrompt', () => {
  it('asks for a personal brief from done work, open work, projects, milestones, and ideas', () => {
    const prompt = buildDailyReportPrompt({
      dateKey: '2026-10-05',
      required: [{ label: '写完接口', completed: true, note: '已合入' }, { label: '还没做', completed: false }],
      optional: [],
      ideas: [{ text: '一个想法', completed: false }],
      projects: [{ name: '垂搜', tasks: [{ text: '对索引', completed: false }, { text: '看日志', completed: true }] }],
      milestones: [{ title: '做出可演示的第一版', date: '2026-10-20', completed: false }],
      reflection: '今天比较顺'
    });
    expect(prompt).not.toContain('AI吊坠BU');
    expect(prompt).toContain('不要使用「某BU 月.日 日报」');
    expect(prompt).toContain('## 建议');
    expect(prompt).toContain('- 写完接口（已合入）');
    expect(prompt).toContain('- 还没做');
    expect(prompt).toContain('垂搜：1/2 已完成');
    expect(prompt).toContain('未完成：对索引');
    expect(prompt).toContain('做出可演示的第一版：2026-10-20，还有 15 天');
    expect(prompt).toContain('- 一个想法');
    expect(prompt).toContain('今天比较顺');
    expect(formatBullets([], '（无）')).toBe('（无）');
  });
});