import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { EventBus } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { IdeaInboxService } from './idea-inbox-service.js';
import { AgentRuntime } from './agent-runtime.js';
import { AgentSession } from './agent-session.js';
import { getDateKey, addDays } from '../domain/shared/date-key.js';

function setup() {
  const store = {};
  const adapter = new LocalStorageAdapter({
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    }
  });
  const eventBus = new EventBus();
  const scheduleService = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus
  });
  scheduleService.load();
  const ideaInboxService = new IdeaInboxService({ scheduleService, eventBus });
  ideaInboxService.addIdea('写引言');
  const viewed = scheduleService.getDateKey();
  const past = getDateKey(addDays(scheduleService.currentDate, -1));
  scheduleService.data[past] = {
    required: [{ id: 'past-1', text: '昨天的论文', note: '', completed: false, tagIds: [], subtasks: [], time: 1, pinned: false, recurrence: '' }],
    optional: [],
    reflection: '',
    reflectionTags: []
  };
  const runtime = new AgentRuntime({ scheduleService, ideaInboxService });
  const lines = [];
  return { scheduleService, ideaInboxService, runtime, viewed, past, lines };
}

describe('agent session', () => {
  it('stages a pure arrange plan and commits it once', async () => {
    const { scheduleService, ideaInboxService, runtime, viewed, past, lines } = setup();
    const ideaId = ideaInboxService.getNodes()[0].id;
    /** @type {any[][]} */
    const seenTools = [];
    const script = [
      { content: '', toolCalls: [{ id: 'a', name: 'list_ready_ideas', arguments: {} }] },
      {
        content: '',
        toolCalls: [
          { id: 'b', name: 'pickup_idea', arguments: { ideaId, date: viewed, list: 'required', tagId: '', text: '写引言', note: '', subtasks: [] } },
          { id: 'c', name: 'copy_open_task', arguments: { sourceDate: past, taskId: 'past-1', date: viewed, list: 'optional', tagId: '', text: '昨天的论文', note: '', subtasks: [] } },
          { id: 'd', name: 'create_task', arguments: { date: viewed, list: 'required', text: '不该新建', note: '', tagId: '', subtasks: [] } }
        ]
      },
      { content: '今天先做这两件。', toolCalls: [] }
    ];
    const session = new AgentSession({
      runtime,
      log: async (record) => {
        lines.push(record);
      },
      complete: async ({ tools }) => {
        seenTools.push(tools.map((tool) => tool.function.name));
        return script.shift();
      }
    });

    const result = await session.submit('安排今天');
    expect(seenTools[0]).not.toContain('create_task');
    expect(seenTools[0]).not.toContain('remove_task');
    expect(result.ok).toBe(true);
    expect(result.rows.map((row) => row.title)).toEqual(['写引言', '昨天的论文']);
    expect(scheduleService.getCurrentData().required.map((task) => task.text)).not.toContain('写引言');

    const edited = await session.editRow(result.rows[1].id, { list: 'required' });
    expect(edited[1].list).toBe('required');
    const committed = await session.confirm();
    expect(committed.ok).toBe(true);
    const day = scheduleService.getCurrentData();
    expect(day.required.map((task) => task.text)).toEqual(['写引言', '昨天的论文']);
    expect(day.optional).toEqual([]);
    expect(ideaInboxService.getNodes()).toEqual([]);
    expect(scheduleService.data[past].required.map((task) => task.id)).toEqual(['past-1']);
    expect(lines.some((line) => line.kind === 'commit_ok')).toBe(true);
    expect(JSON.stringify(lines)).not.toMatch(/apiKey/);
  });

  it('drops the proposal on cancel', async () => {
    const { runtime, viewed } = setup();
    const session = new AgentSession({
      runtime,
      complete: async () => ({
        content: '加一条。',
        toolCalls: [{
          id: 'c',
          name: 'create_task',
          arguments: { date: viewed, list: 'required', text: '晚上发邮件', note: '', tagId: '', subtasks: ['写主题'] }
        }]
      })
    });
    const result = await session.submit('晚上发邮件');
    expect(result.rows[0].title).toBe('晚上发邮件');
    expect(result.rows[0].subtasks).toEqual(['写主题']);
    await session.cancel();
    expect(session.rows()).toEqual([]);
    expect(runtime.scheduleService.getCurrentData().required).toEqual([]);
  });

  it('read permission offers only queries', async () => {
    const { runtime } = setup();
    /** @type {string[]} */
    const names = [];
    const session = new AgentSession({
      runtime,
      complete: async ({ tools }) => {
        names.push(...tools.map((tool) => tool.function.name));
        return { content: '只看不改。', toolCalls: [] };
      }
    });
    session.permission = 'read';
    await session.submit('今天有什么');
    expect(names).toContain('list_day');
    expect(names).not.toContain('create_task');
    expect(names).not.toContain('update_task');
  });

  it('auto commits the new write and leaves the existing card', async () => {
    const { runtime, scheduleService, viewed } = setup();
    const tomorrow = getDateKey(addDays(scheduleService.currentDate, 1));
    const first = [
      {
        content: '',
        toolCalls: [{
          id: 'c',
          name: 'create_task',
          arguments: { date: viewed, list: 'required', text: '晚上发邮件', note: '', tagId: '', subtasks: [] }
        }]
      },
      { content: '先放着。', toolCalls: [] }
    ];
    const session = new AgentSession({
      runtime,
      complete: async () => first.shift()
    });
    const staged = await session.submit('晚上发邮件');
    const kept = staged.rows[0].id;
    session.permission = 'auto';
    const second = [
      {
        content: '',
        toolCalls: [{
          id: 'd',
          name: 'create_task',
          arguments: { date: tomorrow, list: 'optional', text: '明天的笔记', note: '', tagId: '', subtasks: [] }
        }]
      },
      { content: '已经写上。', toolCalls: [] }
    ];
    session.complete = async () => second.shift();
    const result = await session.submit('明天写笔记');
    expect(result.rows.map((row) => row.id)).toEqual([kept]);
    expect(scheduleService.data[tomorrow].optional.map((task) => task.text)).toEqual(['明天的笔记']);
    expect(scheduleService.getCurrentData().required).toEqual([]);
  });

  it('keeps a mentioned day out of the writable dates', async () => {
    const { runtime, viewed } = setup();
    let seen = '';
    const script = [
      {
        content: '',
        toolCalls: [{
          id: 'c',
          name: 'create_task',
          arguments: { date: '2020-01-01', list: 'required', text: '旧日任务', note: '', tagId: '', subtasks: [] }
        }]
      },
      { content: '这一天不能写。', toolCalls: [] }
    ];
    const session = new AgentSession({
      runtime,
      complete: async ({ messages }) => {
        const users = messages.filter((item) => item.role === 'user');
        seen = users[users.length - 1].content;
        return script.shift();
      }
    });
    const result = await session.submit('晚上发邮件', {
      mentions: [{ kind: 'day', id: '2020-01-01', date: '2020-01-01', title: '2020-01-01', label: '2020-01-01' }]
    });
    expect(seen).toContain('已挂上的材料');
    expect(seen).toContain('2020-01-01');
    expect(result.rows).toEqual([]);
    expect(session.messages[0].mentions[0].id).toBe('2020-01-01');
    expect(session.messages[0].text).toBe('晚上发邮件');
    expect(viewed).not.toBe('2020-01-01');
  });

  it('stores reasoning on the assistant turn', async () => {
    const { runtime } = setup();
    const session = new AgentSession({
      runtime,
      complete: async () => ({ content: '好。', reasoning: '先看今天', toolCalls: [] })
    });
    await session.submit('今天呢');
    const assistant = session.messages[session.messages.length - 1];
    expect(assistant.events).toEqual([{ kind: 'reasoning', text: '先看今天' }]);
    expect(assistant.text).toBe('好。');
  });

  it('appends streamed words across a tool round', async () => {
    const { runtime } = setup();
    const script = [
      { content: '我先看。', reasoning: '先看今天', toolCalls: [{ id: 'a', name: 'list_tags', arguments: {} }] },
      { content: '没有标签。', toolCalls: [] }
    ];
    /** @type {string[]} */
    const seen = [];
    const session = new AgentSession({
      runtime,
      onLive: () => {
        const last = session.messages[session.messages.length - 1];
        if (last?.role === 'assistant' && last.text) seen.push(`${session.phase}:${last.text}`);
      },
      complete: async ({ onDelta }) => {
        const next = script.shift();
        if (next?.content) onDelta?.({ type: 'content', text: next.content });
        if (next?.toolCalls?.length) onDelta?.({ type: 'tools' });
        return next;
      }
    });
    const result = await session.submit('今天呢');
    expect(result.ok).toBe(true);
    expect(session.messages.at(-1)?.text).toBe('我先看。没有标签。');
    expect(session.messages.at(-1)?.events?.[0]).toMatchObject({ kind: 'reasoning', text: '先看今天' });
    expect(seen).toContain('text:我先看。');
    expect(seen).toContain('text:我先看。没有标签。');
  });

  it('keeps partial text and appends a failure once', async () => {
    const { runtime } = setup();
    const session = new AgentSession({
      runtime,
      complete: async ({ onDelta }) => {
        onDelta?.({ type: 'content', text: '已经' });
        throw new Error('连接中断');
      }
    });
    const result = await session.submit('今天呢');
    expect(result.ok).toBe(false);
    expect(session.messages.at(-1)?.text).toBe('已经\n连接中断');
  });

  it('stops without a proposal and keeps the words already shown', async () => {
    const { runtime } = setup();
    let markReady = () => {};
    const ready = new Promise((resolve) => { markReady = resolve; });
    const session = new AgentSession({
      runtime,
      complete: ({ onDelta, signal }) => new Promise((_resolve, reject) => {
        onDelta?.({ type: 'content', text: '先看。' });
        const stop = () => {
          const error = new Error('已停止');
          error.name = 'AbortError';
          reject(error);
        };
        if (signal?.aborted) stop();
        else signal?.addEventListener('abort', stop, { once: true });
        markReady();
      })
    });
    const pending = session.submit('晚上发邮件');
    await ready;
    session.requestStop();
    const result = await pending;
    expect(result.stopped).toBe(true);
    expect(result.rows).toEqual([]);
    expect(session.messages.at(-1)?.text).toBe('先看。');
    expect(session.rows()).toEqual([]);
  });
});
