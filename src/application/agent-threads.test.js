import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { createMemoryAgentStore } from '../infrastructure/agent/transcript-store.js';
import { replayTranscript } from '../domain/agent/transcript.js';
import { EventBus } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { IdeaInboxService } from './idea-inbox-service.js';
import { AgentRuntime } from './agent-runtime.js';
import { AgentThreads } from './agent-threads.js';

function setup() {
  const storage = {};
  const adapter = new LocalStorageAdapter({
    getItem: (key) => (key in storage ? storage[key] : null),
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: (key) => { delete storage[key]; }
  });
  const eventBus = new EventBus();
  const scheduleService = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus
  });
  scheduleService.load();
  const runtime = new AgentRuntime({
    scheduleService,
    ideaInboxService: new IdeaInboxService({ scheduleService, eventBus })
  });
  const store = createMemoryAgentStore();
  let serial = 0;
  const threads = new AgentThreads({
    runtime,
    complete: async () => ({ content: '好。', toolCalls: [] }),
    store,
    eventBus,
    defaultModel: () => 'demo',
    createId: () => `thread-${++serial}`,
    now: () => `2026-10-15T00:00:0${serial}.000Z`
  });
  return { threads, store };
}

describe('agent threads', () => {
  it('writes the file on the first sentence and keeps that title', async () => {
    const { threads, store } = setup();
    await threads.setModel('demo-2');
    expect(await store.readIndex()).toBe('');
    await threads.submit(`${'甲'.repeat(30)}尾`);
    const title = threads.view().title;
    expect(title).toBe('甲'.repeat(24));
    await threads.submit('另一句完全不同的话');
    expect(threads.view().title).toBe(title);
    const replayed = replayTranscript(await store.readSession('thread-1'));
    expect(replayed.meta.title).toBe(title);
    expect(replayed.meta.model).toBe('demo-2');
    expect(replayed.messages.map((item) => item.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(replayed.modelMessages.some((item) => item.role === 'user' && String(item.content).includes('甲'))).toBe(true);
  });

  it('locks a renamed title', async () => {
    const { threads } = setup();
    await threads.submit('第一句');
    await threads.rename('自定义');
    await threads.submit('第二句');
    expect(threads.view().title).toBe('自定义');
    expect(threads.view().titleLocked).toBe(true);
  });

  it('falls back to the newest remaining thread after delete', async () => {
    const { threads } = setup();
    await threads.submit('第一段');
    threads.beginNew();
    await threads.submit('第二段');
    expect(threads.view().id).toBe('thread-2');
    await threads.remove('thread-2');
    expect(threads.view().id).toBe('thread-1');
    expect(threads.view().title).toBe('第一段');
  });

  it('refuses to switch while a reply is in progress', async () => {
    const { threads } = setup();
    /** @type {(value: any) => void} */
    let release = () => {};
    let started = () => {};
    const untilModel = new Promise((resolve) => {
      started = resolve;
    });
    threads.complete = () => new Promise((resolve) => {
      release = resolve;
      started();
    });
    const pending = threads.submit('你好');
    await untilModel;
    expect(threads.busy).toBe(true);
    expect(threads.beginNew().ok).toBe(false);
    release({ content: '好。', toolCalls: [] });
    await pending;
    expect(threads.beginNew().ok).toBe(true);
  });

  it('hides the proposal until the reply finishes, and stop drops it', async () => {
    const { threads } = setup();
    const viewed = threads.runtime.scheduleService.getDateKey();
    let step = 0;
    /** @type {(() => void) | null} */
    let started = null;
    const untilSecond = new Promise((resolve) => { started = resolve; });
    threads.complete = ({ onDelta, signal }) => {
      step += 1;
      if (step === 1) {
        onDelta?.({ type: 'content', text: '先看。' });
        return Promise.resolve({
          content: '先看。',
          toolCalls: [{
            id: 'c',
            name: 'create_task',
            arguments: { date: viewed, list: 'required', text: '晚上发邮件', note: '', tagId: '', subtasks: [] }
          }]
        });
      }
      started?.();
      return new Promise((resolve, reject) => {
        onDelta?.({ type: 'content', text: '然后' });
        const stop = () => {
          const error = new Error('已停止');
          error.name = 'AbortError';
          reject(error);
        };
        if (signal?.aborted) stop();
        else signal?.addEventListener('abort', stop, { once: true });
      });
    };
    const pending = threads.submit('晚上发邮件');
    await untilSecond;
    expect(threads.view().arranging).toBe(false);
    expect(threads.view().messages.at(-1)?.text).toBe('先看。然后');
    expect(threads.view().rows).toEqual([]);
    threads.stop();
    const result = await pending;
    expect(result.stopped).toBe(true);
    expect(threads.view().rows).toEqual([]);
    expect(threads.view().messages.at(-1)?.text).toBe('先看。然后');
    expect(threads.busy).toBe(false);
  });
});
