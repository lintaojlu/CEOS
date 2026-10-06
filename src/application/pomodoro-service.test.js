import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { PomodoroRepository } from '../infrastructure/storage/pomodoro-repository.js';
import { EventBus } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { PomodoroService } from './pomodoro-service.js';
import { WORK_MS, BREAK_MS } from '../domain/pomodoro/session.js';
import { getDateKey } from '../domain/shared/date-key.js';

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
  const scheduleService = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus: new EventBus()
  });
  scheduleService.load();
  const eventBus = new EventBus();
  // Share events so task updates reach pomodoro
  scheduleService.eventBus = eventBus;
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
    },
    setNow: (ms) => {
      now = ms;
      pomodoro.tick();
    },
    store
  };
}

describe('PomodoroService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T10:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('awards +1 on the start-day task only and does not add pomodoros to project tasks', () => {
    const { scheduleService, pomodoro, advance } = createStack();
    const project = scheduleService.addProject('CEOS');
    const task = scheduleService.addProjectTask(project.id, '写计划');
    expect(task.pomodoros).toBe(0);

    pomodoro.focusTask('required', task.id);
    advance(WORK_MS);

    expect(scheduleService.getCurrentData().required[0].pomodoros).toBe(1);
    expect(project.tasks[0].pomodoros).toBeUndefined();
    expect(pomodoro.session?.phase).toBe('break');
  });

  it('sync clone resets pomodoros to 0', () => {
    const { scheduleService, pomodoro, advance } = createStack();
    const task = scheduleService.addTask('required', '专注事项');
    pomodoro.focusTask('required', task.id);
    advance(WORK_MS);
    expect(scheduleService.getCurrentData().required[0].pomodoros).toBe(1);

    const day0 = getDateKey(scheduleService.currentDate);
    scheduleService.setCurrentDate(new Date('2026-10-07T10:00:00'));
    scheduleService.syncPrevDayTasks();
    const cloned = scheduleService.getCurrentData().required.find((t) => t.id === task.id);
    expect(cloned.pomodoros).toBe(0);
    expect(scheduleService.data[day0].required[0].pomodoros).toBe(1);
  });

  it('does not award when the bound task was deleted', () => {
    const { scheduleService, pomodoro, advance } = createStack();
    const task = scheduleService.addTask('optional', '临时');
    pomodoro.focusTask('optional', task.id);
    scheduleService.deleteTask('optional', task.id);
    advance(WORK_MS + 1);
    expect(pomodoro.session).toBeNull();
    // day may be empty
    const day = scheduleService.getCurrentData();
    expect(day.optional).toEqual([]);
  });

  it('sleep past work+break awards only once', () => {
    const { scheduleService, pomodoro, advance } = createStack();
    const task = scheduleService.addTask('required', '长睡');
    pomodoro.focusTask('required', task.id);
    advance(WORK_MS + BREAK_MS + 60_000);
    expect(scheduleService.getCurrentData().required[0].pomodoros).toBe(1);
    expect(pomodoro.session).toBeNull();
    advance(WORK_MS);
    expect(scheduleService.getCurrentData().required[0].pomodoros).toBe(1);
  });
});
