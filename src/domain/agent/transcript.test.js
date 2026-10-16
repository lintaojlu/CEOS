import { describe, expect, it } from 'vitest';
import { classifyTurn } from './turn.js';
import {
  filterMentions,
  formatMentions,
  mentionCatalog,
  replayTranscript,
  stripSkillToken,
  threadTitle
} from './transcript.js';

describe('transcript', () => {
  it('takes the title from the first 24 characters', () => {
    expect(threadTitle(`  ${'甲'.repeat(30)}\n`)).toBe('甲'.repeat(24));
  });

  it('strips the schedule skill token', () => {
    expect(stripSkillToken('/日程 安排今天')).toBe('安排今天');
    expect(stripSkillToken('/日程')).toBe('');
  });

  it('lists tasks from every day and does not widen writable dates', () => {
    const items = mentionCatalog({
      today: '2026-10-15',
      tags: [{ id: 'work', name: '工作' }],
      ideas: [{ id: 'idea-1', text: '写引言', dueDate: '' }],
      milestones: [{ id: 'mile-1', title: '交稿', date: '2026-10-20' }],
      schedule: {
        '2026-10-14': { required: [{ id: 'past-1', text: '昨天的论文' }], optional: [] },
        '2026-10-15': { required: [], optional: [] }
      }
    });
    expect(items.some((item) => item.kind === 'task' && item.id === 'past-1' && item.label.includes('2026-10-14'))).toBe(true);
    expect(items.some((item) => item.kind === 'day' && item.id === '2026-10-15')).toBe(true);
    expect(items.some((item) => item.kind === 'tag' && item.title === '工作')).toBe(true);
    expect(filterMentions(items, '论文').map((item) => item.id)).toEqual(['past-1']);
    const mention = formatMentions([{ kind: 'day', id: '2020-01-01', date: '2020-01-01', title: '2020-01-01' }]);
    expect(mention).toContain('2020-01-01');
    expect(classifyTurn('晚上发邮件', { today: '2026-10-15', viewedKey: '2026-10-01' }).writableDates).toEqual(['2026-10-15']);
  });

  it('replays title, reasoning, tools and the saved model text', () => {
    const raw = [
      JSON.stringify({ type: 'meta', id: 'thread-1', title: '第一句', titleLocked: false, model: 'demo', permission: 'read' }),
      JSON.stringify({ type: 'user', text: '第一句', mentions: [], modelContent: '上下文' }),
      JSON.stringify({ type: 'model', message: { role: 'user', content: '上下文' } }),
      JSON.stringify({ type: 'reasoning', text: '先查' }),
      JSON.stringify({ type: 'tool_call', id: 'a', name: 'list_tags', arguments: {} }),
      JSON.stringify({ type: 'tool_result', id: 'a', name: 'list_tags', ok: true, payload: [] }),
      JSON.stringify({ type: 'assistant', text: '没有标签' }),
      JSON.stringify({ type: 'model', message: { role: 'assistant', content: '没有标签' } }),
      JSON.stringify({ type: 'title', title: '自定义', locked: true }),
      JSON.stringify({ type: 'staged', calls: [{ id: 'row-1', name: 'create_task', args: { text: '留下' } }] })
    ].join('\n');
    const state = replayTranscript(raw);
    expect(state.meta).toMatchObject({ id: 'thread-1', title: '自定义', titleLocked: true, model: 'demo', permission: 'read' });
    expect(state.messages[0]).toMatchObject({ role: 'user', text: '第一句' });
    expect(state.messages[1].text).toBe('没有标签');
    expect(state.messages[1].events.map((event) => event.kind)).toEqual(['reasoning', 'tool_call', 'tool_result']);
    expect(state.modelMessages).toEqual([
      { role: 'user', content: '上下文' },
      { role: 'assistant', content: '没有标签' }
    ]);
    expect(state.staged[0].id).toBe('row-1');
  });
});
