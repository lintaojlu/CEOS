import { describe, expect, it } from 'vitest';
import { EventBus } from './event-bus.js';
import { LlmService } from './llm-service.js';
import { ScheduleService } from './schedule-service.js';
import { TaskStandardizeService } from './task-standardize-service.js';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { LlmRequestError } from '../infrastructure/llm/openai-compatible-client.js';
import { addDays, getDateKey } from '../domain/shared/date-key.js';

function createSchedule() {
  const store = {};
  const adapter = new LocalStorageAdapter({
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; }
  });
  const service = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus: new EventBus()
  });
  service.load();
  return service;
}

function llm(settings, chat) {
  return new LlmService({
    settingsRepo: { load: () => settings, save: (next) => next },
    eventBus: new EventBus(),
    chat
  });
}

const settings = {
  baseUrl: 'https://example.com/v1',
  fullUrl: false,
  apiKey: 'k',
  model: 'big',
  standardizeModel: 'short'
};

describe('TaskStandardizeService', () => {
  it('replaces the title and prepends the original on the day the request started', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '下午跟张三对一下标签菜单，确认说明会不会丢');
    schedule.updateTask('required', task.id, { notes: [{ id: 'n1', text: '已有说明' }], completed: true });
    const origin = schedule.currentDate;
    const originKey = getDateKey(origin);
    schedule.setCurrentDate(addDays(origin, 1));
    schedule.insertTask('required', { ...task, text: '另一天的原文', notes: [] });
    schedule.setCurrentDate(origin);
    let seen = null;
    const service = new TaskStandardizeService({
      scheduleService: schedule,
      llmService: llm(settings, async (input) => {
        seen = input;
        schedule.addNote('required', task.id, '等待时补上的说明');
        schedule.setCurrentDate(addDays(origin, 1));
        return '{"title":"对一下标签菜单"}';
      })
    });

    await expect(service.standardize('required', task.id)).resolves.toBe(true);
    expect(seen.model).toBe('short');
    expect(seen.user).toContain('任务标题：\n下午跟张三对一下标签菜单，确认说明会不会丢');
    expect(seen.user).toContain('已有说明：\n已有说明');
    const saved = schedule.data[originKey].required[0];
    expect(saved.text).toBe('对一下标签菜单');
    expect(saved.completed).toBe(true);
    expect(saved.notes.map((note) => note.text)).toEqual([
      '下午跟张三对一下标签菜单，确认说明会不会丢',
      '已有说明',
      '等待时补上的说明'
    ]);
    expect(saved.notes[1].id).toBe('n1');
    schedule.setCurrentDate(addDays(origin, 1));
    expect(schedule.getCurrentData().required[0].text).toBe('另一天的原文');
    expect(schedule.getCurrentData().required[0].notes).toEqual([]);
  });

  it('uses the default model when the standardize model is empty', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '下午对一下菜单');
    let seen = null;
    const service = new TaskStandardizeService({
      scheduleService: schedule,
      llmService: llm({ ...settings, standardizeModel: '' }, async (input) => {
        seen = input;
        return '{"title":"对一下菜单"}';
      })
    });
    await service.standardize('required', task.id);
    expect(seen.model).toBe('big');
  });

  it('does not change the task when no model is configured', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '下午对一下菜单');
    let called = false;
    const service = new TaskStandardizeService({
      scheduleService: schedule,
      llmService: llm({ ...settings, model: '', standardizeModel: '' }, async () => {
        called = true;
        return '{"title":"对一下"}';
      })
    });
    await expect(service.standardize('required', task.id)).rejects.toThrow('请先在设置中填写默认模型');
    expect(called).toBe(false);
    expect(schedule.getCurrentData().required[0].text).toBe('下午对一下菜单');
    expect(schedule.getCurrentData().required[0].notes).toEqual([]);
  });

  it('leaves the task unchanged when the reply is not a new title', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '对一下菜单');
    schedule.addNote('required', task.id, '已有');
    const service = new TaskStandardizeService({
      scheduleService: schedule,
      llmService: llm(settings, async () => '不是 JSON')
    });
    await expect(service.standardize('required', task.id)).rejects.toThrow('没有得到可用的标题');
    expect(schedule.getCurrentData().required[0].text).toBe('对一下菜单');
    expect(schedule.getCurrentData().required[0].notes.map((note) => note.text)).toEqual(['已有']);

    const same = new TaskStandardizeService({
      scheduleService: schedule,
      llmService: llm(settings, async () => '{"title":"对一下菜单"}')
    });
    await expect(same.standardize('required', task.id)).resolves.toBe(false);
    expect(schedule.getCurrentData().required[0].notes.map((note) => note.text)).toEqual(['已有']);
  });

  it('does not add a duplicate note when the original title is already there', async () => {
    const schedule = createSchedule();
    const original = '下午对一下很长的菜单说明';
    const task = schedule.addTask('required', original);
    schedule.addNote('required', task.id, original);
    const service = new TaskStandardizeService({
      scheduleService: schedule,
      llmService: llm(settings, async () => '{"title":"对一下菜单"}')
    });
    await service.standardize('required', task.id);
    expect(schedule.getCurrentData().required[0].text).toBe('对一下菜单');
    expect(schedule.getCurrentData().required[0].notes.map((note) => note.text)).toEqual([original]);
  });

  it('shows the request error and does not change the task', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '下午对一下菜单');
    const service = new TaskStandardizeService({
      scheduleService: schedule,
      llmService: llm(settings, async () => {
        throw new LlmRequestError('网络中断', 'network');
      })
    });
    await expect(service.standardize('required', task.id)).rejects.toThrow('网络中断');
    expect(schedule.getCurrentData().required[0].text).toBe('下午对一下菜单');
    expect(schedule.getCurrentData().required[0].notes).toEqual([]);
  });
});
