import { describe, expect, it } from 'vitest';
import { IDEA_BREAKDOWN_USER_PROMPT } from '../domain/ideas/idea-breakdown.js';
import { createMemoryIdeaStore } from '../infrastructure/storage/idea-file-store.js';
import { EventBus } from './event-bus.js';
import { IdeaBreakdownService } from './idea-breakdown-service.js';
import { IdeaInboxService } from './idea-inbox-service.js';

function setup() {
  const scheduleService = {
    workspace: { ideas: [], tags: [], milestones: [] },
    data: {},
    persist() {},
    getDateKey() {
      return '2026-11-02';
    }
  };
  const store = createMemoryIdeaStore();
  const inbox = new IdeaInboxService({ scheduleService, eventBus: new EventBus(), store });
  return { inbox };
}

describe('IdeaBreakdownService.prepareComposer', () => {
  it('builds context, short body, and an idea mention without calling the model', async () => {
    const { inbox } = setup();
    await inbox.load();
    const idea = inbox.addIdea('肌肉评估', { body: '先定义指标' });

    const service = new IdeaBreakdownService({
      ideaInboxService: inbox,
      now: () => '2026-11-02'
    });
    const draft = service.prepareComposer(idea.id);

    expect(draft.body).toBe(IDEA_BREAKDOWN_USER_PROMPT);
    expect(draft.flyText).toBe(IDEA_BREAKDOWN_USER_PROMPT);
    expect(draft.today).toBe('2026-11-02');
    expect(draft.context).toContain('肌肉评估');
    expect(draft.context).toContain('先定义指标');
    expect(draft.context).toContain('2026-11-02');
    expect(draft.context).toContain('create_task');
    expect(draft.mentions).toEqual([{
      kind: 'idea',
      id: idea.id,
      title: '肌肉评估',
      date: '',
      label: '肌肉评估'
    }]);
  });

  it('rejects missing or archived ideas', async () => {
    const { inbox } = setup();
    await inbox.load();
    const idea = inbox.addIdea('收起来的', { archived: true });
    const service = new IdeaBreakdownService({ ideaInboxService: inbox, now: () => '2026-11-02' });
    expect(() => service.prepareComposer('missing')).toThrow('这条灵感已经不在了');
    expect(() => service.prepareComposer(idea.id)).toThrow('已归档的灵感不能拆解');
  });
});
