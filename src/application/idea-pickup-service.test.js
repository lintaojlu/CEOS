import { describe, expect, it } from 'vitest';
import { EventBus } from './event-bus.js';
import { IdeaInboxService } from './idea-inbox-service.js';
import { IdeaPickupService } from './idea-pickup-service.js';
import { createMemoryIdeaStore } from '../infrastructure/storage/idea-file-store.js';
import { parseDateKey } from '../domain/shared/date-key.js';

const TODAY = '2026-10-16';
const VIEWED = '2026-10-01';

function setup() {
  const data = {
    [VIEWED]: { required: [], optional: [] }
  };
  const scheduleService = {
    workspace: { ideas: [], tags: [], milestones: [] },
    data,
    currentDate: parseDateKey(VIEWED),
    persist() {},
    getDateKey() {
      return VIEWED;
    },
    getCurrentData() {
      return data[VIEWED];
    },
    insertTaskOnDate(dateKey, type, task) {
      if (!data[dateKey]) data[dateKey] = { required: [], optional: [] };
      data[dateKey][type].push(task);
    }
  };
  const store = createMemoryIdeaStore();
  const inbox = new IdeaInboxService({ scheduleService, eventBus: new EventBus(), store });
  return { scheduleService, store, inbox, data };
}

describe('idea pickup', () => {
  it('lists parsed tasks and writes them to today only after confirm', async () => {
    const { inbox, store, data, scheduleService } = setup();
    await inbox.load();
    const idea = inbox.addIdea('写一篇', {
      body: '先列提纲\n![](idea-image:pic1)',
      images: { pic1: { mime: 'image/png', base64: 'QUJD' } }
    });
    let prompt = '';
    const llm = {
      async complete({ user }) {
        prompt = user;
        return JSON.stringify([
          { title: '列提纲', note: '三节' },
          { title: '写开头', note: '' }
        ]);
      }
    };
    const pickup = new IdeaPickupService({
      ideaInboxService: inbox,
      scheduleService,
      llmService: llm,
      now: () => TODAY
    });
    const preview = await pickup.preview(idea.id);
    expect(preview.tasks).toEqual([
      { title: '列提纲', note: '三节' },
      { title: '写开头', note: '' }
    ]);
    expect(prompt).toContain('写一篇');
    expect(prompt).toContain('先列提纲');
    expect(prompt).not.toContain('QUJD');
    expect(data[TODAY]).toBeUndefined();
    expect(await store.read(idea.id)).not.toBe('');

    const committed = pickup.commit(idea.id, preview.tasks);
    expect(committed).toEqual({ date: TODAY, count: 2 });
    expect(data[VIEWED].required).toEqual([]);
    expect(data[TODAY].required.map((task) => task.text)).toEqual(['列提纲', '写开头']);
    expect(data[TODAY].required[0].notes.map((note) => note.text)).toEqual(['三节']);
    expect(data[TODAY].required[0].tagIds).toEqual([]);
    expect(JSON.stringify(data[TODAY])).not.toMatch(/人类任务|AI任务/);
    expect(await store.read(idea.id)).toBe('');
    expect(inbox.getNodes()).toEqual([]);
  });

  it('keeps the idea when the model fails or the reply cannot be read', async () => {
    const { inbox, store, scheduleService } = setup();
    await inbox.load();
    const idea = inbox.addIdea('还在', { body: '正文' });
    const failing = new IdeaPickupService({
      ideaInboxService: inbox,
      scheduleService,
      llmService: { async complete() { throw new Error('模型失败'); } },
      now: () => TODAY
    });
    await expect(failing.preview(idea.id)).rejects.toThrow(/模型失败/);
    expect(inbox.getNodes()).toHaveLength(1);
    expect(scheduleService.data[TODAY]).toBeUndefined();

    const unreadable = new IdeaPickupService({
      ideaInboxService: inbox,
      scheduleService,
      llmService: { async complete() { return '不是 json'; } },
      now: () => TODAY
    });
    await expect(unreadable.preview(idea.id)).rejects.toThrow(/读不出来/);
    expect(await store.read(idea.id)).not.toBe('');
    expect(() => unreadable.commit(idea.id, [])).toThrow(/读不出来/);
    expect(inbox.getNodes().map((node) => node.id)).toEqual([idea.id]);
    expect(scheduleService.data[TODAY]).toBeUndefined();
  });
});
