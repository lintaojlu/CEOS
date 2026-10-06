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

describe('project tasks share an id with the daily copy', () => {
  it('writes both records on create and mirrors completion', () => {
    const service = createService();
    const project = service.addProject('垂搜知识图谱');
    const task = service.addProjectTask(project.id, '把代码跑通');
    const day = service.getCurrentData();
    const projectTask = project.tasks.find((t) => t.id === task.id);

    expect(day.required.map((t) => t.id)).toEqual([task.id]);
    expect(projectTask).toBeTruthy();
    expect(projectTask.text).toBe('把代码跑通');
    expect(projectTask.completed).toBe(false);
    expect(projectTask).not.toBe(day.required[0]);

    service.toggleTask('required', task.id);
    expect(day.required[0].completed).toBe(true);
    expect(projectTask.completed).toBe(true);

    const today = service.currentDate;
    service.setCurrentDate(addDays(today, 1));
    expect(service.getCurrentData().required).toEqual([]);
    expect(project.tasks[0].completed).toBe(true);
    expect(service.workspace.ideas).toEqual([]);

    const prevKey = getDateKey(today);
    service.data[prevKey].required[0].completed = false;
    service.syncPrevDayTasks();
    expect(service.getCurrentData().required.map((t) => t.id)).toEqual([task.id]);

    service.getCurrentData().required[0].completed = true;
    service.data[prevKey].required[0].completed = true;
    service.getCurrentData().required = [];
    service.syncPrevDayTasks();
    expect(service.getCurrentData().required).toEqual([]);
    expect(project.tasks[0].completed).toBe(true);
    expect(service.workspace.projects).toHaveLength(1);
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

  it('links a bracket title to a project task and keeps the project task when the day row is deleted', () => {
    const service = createService();
    const task = service.addTask('optional', '【CEOS】写计划');
    const project = service.workspace.projects.find((p) => p.name === 'CEOS');
    expect(project.tasks.map((t) => t.id)).toEqual([task.id]);
    expect(project.tasks[0].list).toBe('optional');
    expect(service.getCurrentData().optional[0].projectId).toBe(project.id);

    const day1 = getDateKey(service.currentDate);
    service.deleteTask('optional', task.id);
    expect(service.getCurrentData().optional).toEqual([]);
    expect(project.tasks).toHaveLength(1);

    service.data[day1].optional.push({ ...task, completed: false, projectId: project.id });
    service.setCurrentDate(addDays(service.currentDate, 1));
    service.insertTask('required', {
      ...task,
      completed: false,
      projectId: project.id,
      subtasks: []
    });
    service.deleteProjectTask(project.id, task.id);
    expect(project.tasks).toEqual([]);
    expect(service.getCurrentData().required).toEqual([]);
    expect(service.data[day1].optional.map((t) => t.id)).toEqual([task.id]);
  });

  it('mirrors a subtask checkbox onto the current day copy', () => {
    const service = createService();
    const project = service.addProject('CEOS');
    const task = service.addProjectTask(project.id, '父任务');
    const sub = service.addSubtask('required', task.id, '步骤');
    expect(project.tasks[0].subtasks.map((item) => item.id)).toEqual([sub.id]);

    service.toggleProjectSubtask(project.id, task.id, sub.id);
    expect(project.tasks[0].subtasks[0].completed).toBe(true);
    expect(service.getCurrentData().required[0].subtasks[0].completed).toBe(true);

    service.toggleTask('required', task.id);
    expect(project.tasks[0].completed).toBe(true);
  });

  it('mirrors title and note between the viewed day and the project, and leaves other days', () => {
    const service = createService();
    const project = service.addProject('CEOS');
    const task = service.addProjectTask(project.id, '写计划');
    const today = service.currentDate;
    const todayKey = getDateKey(today);

    service.updateTask('required', task.id, { text: '【CEOS】改清单', note: '清单备注' });
    expect(service.getCurrentData().required[0].text).toBe('改清单');
    expect(project.tasks[0].text).toBe('改清单');
    expect(project.tasks[0].note).toBe('清单备注');

    service.setCurrentDate(addDays(today, 1));
    service.updateProjectTask(project.id, task.id, { text: '改项目', note: '项目备注' });
    expect(project.tasks[0].text).toBe('改项目');
    expect(service.data[todayKey].required[0].text).toBe('改清单');
    expect(service.data[todayKey].required[0].note).toBe('清单备注');

    service.setCurrentDate(today);
    service.updateProjectTask(project.id, task.id, { text: '再改项目', note: '新备注' });
    expect(service.getCurrentData().required[0].text).toBe('再改项目');
    expect(service.getCurrentData().required[0].note).toBe('新备注');
    expect(project.tasks[0]).not.toBe(service.getCurrentData().required[0]);
  });

  it('mirrors subtask text, adds, and deletes both ways', () => {
    const service = createService();
    const project = service.addProject('CEOS');
    const task = service.addProjectTask(project.id, '父任务');
    const sub = service.addSubtask('required', task.id, '步骤');

    service.updateSubtask('required', task.id, sub.id, '改步骤');
    expect(project.tasks[0].subtasks[0].text).toBe('改步骤');

    const added = service.addProjectSubtask(project.id, task.id, '项目步骤');
    expect(service.getCurrentData().required[0].subtasks.map((item) => item.text)).toEqual(['改步骤', '项目步骤']);

    service.deleteProjectSubtask(project.id, task.id, added.id);
    expect(service.getCurrentData().required[0].subtasks.map((item) => item.id)).toEqual([sub.id]);

    service.deleteSubtask('required', task.id, sub.id);
    expect(project.tasks[0].subtasks).toEqual([]);
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

describe('pomodoros on daily tasks', () => {
  it('incrementPomodoro only mutates the given date copy and leaves project tasks without pomodoros', () => {
    const service = createService();
    const project = service.addProject('CEOS');
    const task = service.addProjectTask(project.id, '番茄');
    const key = getDateKey(service.currentDate);
    expect(service.incrementPomodoro(key, 'required', task.id)).toBe(true);
    expect(service.getCurrentData().required[0].pomodoros).toBe(1);
    expect(project.tasks[0].pomodoros).toBeUndefined();
  });

  it('sync clone starts pomodoros at 0', () => {
    const service = createService();
    const task = service.addTask('required', '带次数');
    const key = getDateKey(service.currentDate);
    service.incrementPomodoro(key, 'required', task.id);
    service.incrementPomodoro(key, 'required', task.id);
    expect(service.data[key].required[0].pomodoros).toBe(2);

    service.setCurrentDate(addDays(service.currentDate, 1));
    service.syncPrevDayTasks();
    expect(service.getCurrentData().required[0].pomodoros).toBe(0);
    expect(service.data[key].required[0].pomodoros).toBe(2);
  });

  it('incrementPomodoro is a no-op after the task is deleted', () => {
    const service = createService();
    const task = service.addTask('optional', '将删');
    const key = getDateKey(service.currentDate);
    service.deleteTask('optional', task.id);
    expect(service.incrementPomodoro(key, 'optional', task.id)).toBe(false);
  });
});
