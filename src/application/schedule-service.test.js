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
    project.tasks[0].subtasks.push({ ...sub });

    service.toggleProjectSubtask(project.id, task.id, sub.id);
    expect(project.tasks[0].subtasks[0].completed).toBe(true);
    expect(service.getCurrentData().required[0].subtasks[0].completed).toBe(true);

    service.toggleTask('required', task.id);
    expect(project.tasks[0].completed).toBe(true);
  });
});
