import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { LlmRequestError } from '../infrastructure/llm/openai-compatible-client.js';
import { addDays, getDateKey } from '../domain/shared/date-key.js';
import { AI_TASK_TITLE, HUMAN_TASK_TITLE } from '../domain/schedule/task-breakdown.js';
import { EventBus } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { TaskBreakdownService } from './task-breakdown-service.js';

function createSchedule() {
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
  const service = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus: new EventBus()
  });
  service.load();
  return service;
}

describe('TaskBreakdownService', () => {
  it('writes two notes on the day that was open when the request started', async () => {
    const schedule = createSchedule();
    const work = schedule.addTag('工作');
    const ceos = schedule.addTag('CEOS');
    const task = schedule.addTask('required', '做拆解', [work.id, ceos.id]);
    schedule.addNote('required', task.id, '先看现有说明');
    const origin = schedule.currentDate;
    const originKey = getDateKey(origin);

    schedule.setCurrentDate(addDays(origin, -1));
    const past = schedule.addTask('required', '昨天的同类', ceos.id);
    schedule.addNote('required', past.id, '秘密说明');
    schedule.toggleTask('required', past.id);
    schedule.setCurrentDate(origin);

    let seen = '';
    const service = new TaskBreakdownService({
      scheduleService: schedule,
      llmService: {
        complete: async ({ system, user }) => {
          seen = `${system}\n${user}`;
          schedule.addNote('required', task.id, '等待时补上的说明');
          schedule.setCurrentDate(addDays(origin, 1));
          return '人类任务\n亲手做\n\nAI任务\n请实现拆解';
        }
      }
    });

    await service.breakdown('required', task.id);

    expect(seen).toContain('做拆解');
    expect(seen).toContain('先看现有说明');
    expect(seen).toContain('昨天的同类');
    expect(seen).toContain('完成');
    expect(seen).not.toContain('秘密说明');
    const texts = schedule.data[originKey].required[0].notes.map((note) => note.text);
    expect(texts).toEqual([
      '先看现有说明',
      '等待时补上的说明',
      `${HUMAN_TASK_TITLE}\n亲手做`,
      `${AI_TASK_TITLE}\n请实现拆解`
    ]);
    expect(schedule.getCurrentData().required).toEqual([]);
  });

  it('leaves notes unchanged when the reply cannot be read', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '做拆解');
    schedule.addNote('required', task.id, '手写');
    const service = new TaskBreakdownService({
      scheduleService: schedule,
      llmService: { complete: async () => '没有按格式写' }
    });

    await expect(service.breakdown('required', task.id)).rejects.toThrow('拆解结果无法读成两条说明');
    expect(schedule.getCurrentData().required[0].notes.map((note) => note.text)).toEqual(['手写']);
  });

  it('leaves notes unchanged when the model request fails', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '做拆解');
    schedule.addNote('required', task.id, '手写');
    const service = new TaskBreakdownService({
      scheduleService: schedule,
      llmService: {
        complete: async () => {
          throw new LlmRequestError('网络中断', 'network');
        }
      }
    });

    await expect(service.breakdown('required', task.id)).rejects.toThrow('网络中断');
    expect(schedule.getCurrentData().required[0].notes.map((note) => note.text)).toEqual(['手写']);
  });
});
