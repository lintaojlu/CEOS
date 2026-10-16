import { describe, it, expect } from 'vitest';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { EventBus } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { getDateKey, addDays } from '../domain/shared/date-key.js';

function createService() {
  const store = {};
  const adapter = new LocalStorageAdapter({
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    }
  });
  const service = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus: new EventBus()
  });
  service.load();
  return service;
}

describe('tags on daily tasks', () => {
  it('keeps a bracket title as plain text and does not create a tag', () => {
    const service = createService();
    const task = service.addTask('optional', '【CEOS】写计划');
    expect(task.text).toBe('【CEOS】写计划');
    expect(task.tagIds).toEqual([]);
    expect(service.workspace.tags.map((tag) => tag.name)).toEqual(['生活', '工作']);
    expect(service.workspace.tags.map((tag) => tag.color)).toEqual(['#F5C400', '#111111']);
    expect(service.taskTitle(task)).toBe('【CEOS】写计划');
  });

  it('attaches the only selected tag when adding a task', () => {
    const service = createService();
    const tag = service.addTag('CEOS');
    const task = service.addTask('required', '写计划', tag.id);
    expect(task.tagIds).toEqual([tag.id]);
    expect(service.addTag('CEOS')).toBeNull();
  });

  it('keeps several tags on one task and drops only the deleted one', () => {
    const service = createService();
    const first = service.addTag('CEOS');
    const second = service.addTag('攀岩');
    const task = service.addTask('required', '写计划', [first.id, second.id]);
    expect(task.tagIds).toEqual([first.id, second.id]);
    service.deleteTag(second.id);
    expect(service.getCurrentData().required[0].text).toBe('写计划');
    expect(service.getCurrentData().required[0].tagIds).toEqual([first.id]);
  });

  it('changes the tag only on the viewed day', () => {
    const service = createService();
    const tag = service.addTag('CEOS');
    const other = service.addTag('攀岩');
    const task = service.addTask('required', '写计划', tag.id);
    const today = service.currentDate;
    const todayKey = getDateKey(today);

    service.setCurrentDate(addDays(today, 1));
    service.insertTask('required', { ...task, tagId: tag.id, subtasks: [] });
    service.setTaskTag('required', task.id, other.id);
    expect(service.getCurrentData().required[0].tagIds).toEqual([other.id]);
    expect(service.data[todayKey].required[0].tagIds).toEqual([tag.id]);
  });

  it('copies the tag when syncing, then leaves the two days independent', () => {
    const service = createService();
    const tag = service.addTag('CEOS');
    const task = service.addTask('required', '留下', tag.id);
    const originKey = getDateKey(service.currentDate);
    service.setCurrentDate(addDays(service.currentDate, 1));
    expect(service.syncTasksFrom(originKey)).toBe(true);
    expect(service.getCurrentData().required[0].tagIds).toEqual([tag.id]);
    service.setTaskTag('required', task.id, '');
    expect(service.getCurrentData().required[0].tagIds).toEqual([]);
    expect(service.data[originKey].required[0].tagIds).toEqual([tag.id]);
  });

  it('deletes a tag by clearing the mark on every day', () => {
    const service = createService();
    const tag = service.addTag('CEOS');
    const task = service.addTask('required', '写计划', tag.id);
    const todayKey = getDateKey(service.currentDate);
    service.setCurrentDate(addDays(service.currentDate, 1));
    service.insertTask('optional', { ...task, tagId: tag.id, subtasks: [] });
    service.deleteTag(tag.id);
    expect(service.workspace.tags.map((tag) => tag.name)).toEqual(['生活', '工作']);
    service.deleteTag(service.workspace.tags[0].id);
    expect(service.renameTag(service.workspace.tags[0].id, '日常')).toBeNull();
    expect(service.workspace.tags.map((tag) => tag.name)).toEqual(['生活', '工作']);
    expect(service.data[todayKey].required[0].text).toBe('写计划');
    expect(service.data[todayKey].required[0].tagIds).toEqual([]);
    expect(service.getCurrentData().optional[0].tagIds).toEqual([]);
  });

  it('renames a tag without rewriting task ids', () => {
    const service = createService();
    const tag = service.addTag('CEOS');
    const task = service.addTask('required', '写计划', tag.id);
    expect(service.renameTag(tag.id, '日程')).toBeTruthy();
    expect(service.workspace.tags.find((item) => item.id === tag.id).name).toBe('日程');
    expect(service.getCurrentData().required[0].tagIds).toEqual(task.tagIds);
  });

  it('copies unfinished tasks from a chosen day, not only yesterday', () => {
    const service = createService();
    const origin = service.currentDate;
    const originKey = getDateKey(origin);
    service.addTask('required', '留下');
    service.addTask('optional', '做完了');
    service.getCurrentData().optional[0].completed = true;
    service.setCurrentDate(addDays(origin, 3));
    service.addTask('required', '当天的');

    expect(service.listSyncSources().map((row) => row.dateKey)).toContain(originKey);
    expect(service.syncTasksFrom(service.getDateKey())).toBe(false);
    expect(service.syncTasksFrom(originKey)).toBe(true);

    const required = service.getCurrentData().required.map((t) => t.text);
    expect(required).toContain('留下');
    expect(required).toContain('当天的');
    expect(service.getCurrentData().optional).toEqual([]);
    expect(service.syncTasksFrom(originKey)).toBe(true);
    expect(service.getCurrentData().required.filter((t) => t.text === '留下')).toHaveLength(1);
  });

  it('keeps drag order inside a column and when moving between columns', () => {
    const service = createService();
    const first = service.addTask('required', '甲');
    const second = service.addTask('required', '乙');
    const third = service.addTask('required', '丙');
    service.placeTask('required', third.id, 'required', first.id);
    expect(service.getCurrentData().required.map((task) => task.text)).toEqual(['丙', '甲', '乙']);

    const fourth = service.addTask('optional', '丁');
    service.placeTask('required', first.id, 'optional', fourth.id);
    expect(service.getCurrentData().required.map((task) => task.id)).toEqual([third.id, second.id]);
    expect(service.getCurrentData().optional.map((task) => task.text)).toEqual(['甲', '丁']);
  });
});
