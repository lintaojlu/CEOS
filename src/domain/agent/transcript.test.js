import { describe, expect, it } from 'vitest';
import { classifyTurn } from './turn.js';
import {
  conversationWindow,
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
    expect(stripSkillToken('请 /日程 安排')).toBe('请 安排');
    const note = '【离职交接 Todo】\n\n一、工作内容交接\n□ 知识挖掘项目\n  □ 整理并移交全部源码';
    expect(stripSkillToken(note)).toBe(note);
    expect(stripSkillToken(`/日程\n${note}`)).toBe(note);
  });

  it('lists tasks from every day and does not widen writable dates', () => {
    const items = mentionCatalog({
      today: '2026-10-15',
      tags: [{ id: 'work', name: '工作' }],
      ideas: [{ id: 'idea-1', text: '写引言', dueDate: '' }],
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

  it('keeps the system prompt and the last 20 turns', () => {
    const messages = [{ role: 'system', content: '规则' }];
    for (let index = 0; index < 21; index += 1) {
      messages.push({ role: 'user', content: `第${index}句` });
      messages.push({ role: 'assistant', content: '好', tool_calls: [{ id: `c${index}` }] });
      messages.push({ role: 'tool', tool_call_id: `c${index}`, content: '{}' });
    }
    const windowed = conversationWindow(messages);
    const users = windowed.filter((item) => item.role === 'user');
    expect(windowed[0]).toEqual({ role: 'system', content: '规则' });
    expect(users).toHaveLength(20);
    expect(users[0].content).toBe('第1句');
    expect(users.at(-1).content).toBe('第20句');
    expect(windowed.some((item) => item.tool_call_id === 'c0')).toBe(false);
    expect(windowed.some((item) => item.tool_call_id === 'c1')).toBe(true);
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
