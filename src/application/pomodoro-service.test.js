import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { PomodoroRepository } from '../infrastructure/storage/pomodoro-repository.js';
import { EventBus } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { PomodoroService } from './pomodoro-service.js';
import { focusMs } from '../domain/pomodoro/session.js';

function createStack(startMs = 1_000_000) {
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
  let now = startMs;
  const eventBus = new EventBus();
  const scheduleService = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus
  });
  scheduleService.load();
  const pomodoro = new PomodoroService({
    pomodoroRepo: new PomodoroRepository(adapter),
    scheduleService,
    eventBus,
    now: () => now
  });
  pomodoro.startTicker = () => {};
  pomodoro.load();
  return {
    scheduleService,
    pomodoro,
    advance: (ms) => {
      now += ms;
      pomodoro.tick();
    }
  };
}

describe('PomodoroService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T10:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('focus opens the dial and begin starts the chosen countdown', () => {
    const { scheduleService, pomodoro } = createStack();
    const task = scheduleService.addTask('required', '写计划');
    pomodoro.focusTask('required', task.id);
    expect(pomodoro.session?.phase).toBe('setup');
    expect(task.completed).toBe(false);

    pomodoro.setDuration(10);
    expect(pomodoro.session?.durationMs).toBe(focusMs(10));
    pomodoro.begin();
    expect(pomodoro.session?.phase).toBe('work');
    expect(pomodoro.session?.endsAt).toBe(1_000_000 + focusMs(10));
    expect(scheduleService.getCurrentData().required[0].completed).toBe(false);
  });

  it('time running out keeps the round open and does not check the task', () => {
    const { scheduleService, pomodoro, advance } = createStack();
    const task = scheduleService.addTask('required', '等结束');
    pomodoro.focusTask('required', task.id);
    pomodoro.setDuration(5);
    pomodoro.begin();
    advance(focusMs(5) + 1000);
    expect(pomodoro.session?.phase).toBe('work');
    expect(scheduleService.getCurrentData().required[0].completed).toBe(false);
  });

  it('complete checks the task and ends; abandon ends without checking', () => {
    const { scheduleService, pomodoro } = createStack();
    const done = scheduleService.addTask('required', '做完');
    pomodoro.focusTask('required', done.id);
    pomodoro.begin();
    pomodoro.complete();
    expect(pomodoro.session).toBeNull();
    expect(scheduleService.getCurrentData().required[0].completed).toBe(true);

    const left = scheduleService.addTask('optional', '放下');
    pomodoro.focusTask('optional', left.id);
    pomodoro.begin();
    pomodoro.abandon();
    expect(pomodoro.session).toBeNull();
    expect(scheduleService.getCurrentData().optional[0].completed).toBe(false);
  });

  it('abandon before start does not check the task', () => {
    const { scheduleService, pomodoro } = createStack();
    const task = scheduleService.addTask('required', '还没开始');
    pomodoro.focusTask('required', task.id);
    pomodoro.abandon();
    expect(pomodoro.session).toBeNull();
    expect(scheduleService.getCurrentData().required[0].completed).toBe(false);
  });

  it('drops the round when the bound task is deleted', () => {
    const { scheduleService, pomodoro } = createStack();
    const task = scheduleService.addTask('optional', '临时');
    pomodoro.focusTask('optional', task.id);
    pomodoro.begin();
    scheduleService.deleteTask('optional', task.id);
    expect(pomodoro.session).toBeNull();
  });
});
