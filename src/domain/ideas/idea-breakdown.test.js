import { describe, expect, it } from 'vitest';
import {
  IDEA_BREAKDOWN_AGENT_RULES,
  IDEA_BREAKDOWN_USER_PROMPT,
  buildIdeaBreakdownContext,
  buildIdeaBreakdownPrompt,
  ideaBreakdownMaterials
} from './idea-breakdown.js';

describe('idea breakdown context', () => {
  it('puts rules, title, today, and body into the capsule', () => {
    const context = buildIdeaBreakdownContext({
      title: '肌肉评估原型',
      body: '先定义指标',
      today: '2026-11-02'
    });
    expect(context).toContain(IDEA_BREAKDOWN_AGENT_RULES.slice(0, 20));
    expect(context).toContain('create_task');
    expect(context).toContain('update_idea');
    expect(context).toContain('不要用 pickup_idea');
    expect(context).toContain('标签');
    expect(context).not.toContain('tagId 留空');
    expect(context).toContain('肌肉评估原型');
    expect(context).toContain('2026-11-02');
    expect(context).toContain('先定义指标');
  });

  it('builds materials without image data urls', () => {
    expect(ideaBreakdownMaterials({
      body: '标题\n![](data:image/png;base64,AAA)\n正文'
    }, '2026-11-02')).toEqual({
      title: '标题',
      body: '标题\n\n正文',
      today: '2026-11-02'
    });
  });

  it('keeps a short user prompt', () => {
    expect(IDEA_BREAKDOWN_USER_PROMPT).toBe('把这条灵感拆成今天可做的任务');
    expect(buildIdeaBreakdownPrompt({ title: '甲', body: '', today: '2026-11-02' })).toContain('（没有）');
  });
});
