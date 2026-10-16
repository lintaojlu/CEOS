import { describe, expect, it } from 'vitest';
import { EventBus } from './event-bus.js';
import { IdeaInboxService } from './idea-inbox-service.js';
import { createMemoryIdeaStore } from '../infrastructure/storage/idea-file-store.js';

function setup(ideas = []) {
  const workspace = { ideas, tags: [], milestones: [] };
  let persisted = 0;
  const scheduleService = {
    workspace,
    data: {},
    persist() {
      persisted += 1;
    },
    getDateKey() {
      return '2026-10-01';
    }
  };
  const store = createMemoryIdeaStore();
  const service = new IdeaInboxService({ scheduleService, eventBus: new EventBus(), store });
  return { service, store, workspace, persisted: () => persisted };
}

describe('idea file migration', () => {
  it('writes each workspace idea to its own file and then clears the workspace', async () => {
    const { service, store, workspace } = setup([
      {
        id: 'idea-1',
        text: '旧标题',
        note: '旧正文',
        dependsOn: [{ scope: 'idea', id: 'other' }],
        position: { x: 1, y: 2 },
        completed: false,
        pinned: true,
        dueDate: '2026-10-20',
        createdAt: 10
      }
    ]);
    await service.load();
    expect(workspace.ideas).toEqual([]);
    const file = JSON.parse(await store.read('idea-1'));
    expect(file).toMatchObject({
      id: 'idea-1',
      body: '旧标题\n\n旧正文',
      pinned: true,
      createdAt: 10
    });
    expect(file.title).toBeUndefined();
    expect(file.dueDate).toBeUndefined();
    expect(file.dependsOn).toBeUndefined();
    expect(file.position).toBeUndefined();
    expect(service.getNodes()[0].title).toBe('旧标题');
    expect(service.getNodes()[0].body).toBe('旧标题\n\n旧正文');
  });

  it('does not copy again when the file already exists', async () => {
    const { service, store, workspace } = setup([
      { id: 'idea-1', text: '第一次', note: '正文' }
    ]);
    await service.load();
    await store.write({
      id: 'idea-1',
      title: '文件里的',
      body: '已改',
      images: {},
      completed: false,
      pinned: false,
      dueDate: null,
      createdAt: 1
    });
    workspace.ideas = [{ id: 'idea-1', text: '又来了', note: '不该覆盖' }];
    await service.load();
    const file = JSON.parse(await store.read('idea-1'));
    expect(file.title).toBeUndefined();
    expect(file.body).toBe('文件里的\n\n已改');
    expect(workspace.ideas).toEqual([]);
    expect(await store.listIds()).toEqual(['idea-1']);
  });

  it('does not use an unsafe id as a filename', async () => {
    const { service, store } = setup([
      { id: '../etc/passwd', text: '标题', note: '正文' }
    ]);
    await service.load();
    const ids = await store.listIds();
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toContain('/');
    expect(ids[0]).not.toContain('.');
    const file = JSON.parse(await store.read(ids[0]));
    expect(file.title).toBeUndefined();
    expect(file.body).toBe('标题\n\n正文');
  });

  it('deletes the one file and keeps a deferred task as title plus notes', async () => {
    const { service, store } = setup([]);
    await service.load();
    const node = service.deferFromDaily({
      id: 'task-1',
      text: '任务标题',
      notes: [{ id: 'n1', text: '说明一' }, { id: 'n2', text: '说明二' }]
    });
    expect(node.title).toBe('任务标题');
    expect(node.body).toBe('任务标题\n\n说明一\n说明二');
    expect(JSON.parse(await store.read('task-1')).body).toBe('任务标题\n\n说明一\n说明二');
    service.delete(node.id);
    expect(await store.read('task-1')).toBe('');
    expect(service.getNodes()).toEqual([]);
  });
});
