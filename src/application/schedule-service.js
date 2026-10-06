import { createEmptyWorkspace } from '../data/workspace-record.js';
import { getDateKey, addDays, todayKey } from '../domain/shared/date-key.js';
import { createDailyTask, createSubtask, sortTasks, parseTime, normalizeSubtasks } from '../domain/schedule/daily-task.js';
import { parseProjectTitle, formatProjectTaskTitle } from '../domain/schedule/project-title.js';
import { syncPrevDay } from '../domain/schedule/schedule-day.js';
import { Events } from './event-bus.js';

export class ScheduleService {
  /**
   * @param {object} deps
   * @param {import('../infrastructure/storage/schedule-repository.js').ScheduleRepository} deps.scheduleRepo
   * @param {import('../infrastructure/storage/workspace-repository.js').WorkspaceRepository} deps.workspaceRepo
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ scheduleRepo, workspaceRepo, eventBus }) {
    this.scheduleRepo = scheduleRepo;
    this.workspaceRepo = workspaceRepo;
    this.eventBus = eventBus;
    /** @type {Record<string, any>} */
    this.data = {};
    /** @type {import('../data/workspace-record.js').WorkspaceRecord} */
    this.workspace = createEmptyWorkspace();
    this.currentDate = new Date();
  }

  load() {
    this.data = this.scheduleRepo.load();
    this.workspace = this.workspaceRepo.load();
  }

  persist() {
    this.scheduleRepo.save(this.data);
    this.workspaceRepo.save(this.workspace);
  }

  getDateKey(date = this.currentDate) {
    return getDateKey(date);
  }

  getCurrentData() {
    const key = this.getDateKey();
    return this.scheduleRepo.ensureDay(this.data, key);
  }

  setCurrentDate(date) {
    this.currentDate = date;
    this.eventBus.emit(Events.DATE_CHANGED, { dateKey: this.getDateKey() });
  }

  prevDay() {
    this.setCurrentDate(addDays(this.currentDate, -1));
  }

  nextDay() {
    this.setCurrentDate(addDays(this.currentDate, 1));
  }

  goToday() {
    this.setCurrentDate(new Date());
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} text
   */
  addTask(type, text) {
    const parsed = parseProjectTitle(text);
    const title = parsed ? parsed.text : text;
    const project = parsed ? this.ensureProject(parsed.name) : null;
    const data = this.getCurrentData();
    const task = createDailyTask(title, this.currentDate, { projectId: project ? project.id : '' });
    data[type].push(task);
    if (project) this._attachProjectTask(project, task, type);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type });
    return task;
  }

  /**
   * @param {import('../domain/schedule/daily-task.js').DailyTask|null|undefined} task
   * @returns {string}
   */
  taskTitle(task) {
    if (!task) return '';
    const project = (this.workspace.projects || []).find((p) => p.id === task.projectId);
    if (!project) return task.text || '';
    return formatProjectTaskTitle(project.name, task.text || '');
  }

  /**
   * @param {string} name
   * @returns {import('../data/workspace-record.js').ProjectRecord|null}
   */
  ensureProject(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    if (!Array.isArray(this.workspace.projects)) this.workspace.projects = [];
    const existing = this.workspace.projects.find((p) => p.name === trimmed);
    if (existing) {
      if (!Array.isArray(existing.tasks)) existing.tasks = [];
      return existing;
    }
    const project = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      tasks: []
    };
    this.workspace.projects.push(project);
    return project;
  }

  /** @param {string} name */
  addProject(name) {
    const project = this.ensureProject(name);
    if (!project) return null;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'project:add' });
    return project;
  }

  /**
   * @param {string} id
   * @param {string} name
   */
  renameProject(id, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const project = (this.workspace.projects || []).find((p) => p.id === id);
    if (!project) return null;
    const clash = (this.workspace.projects || []).find((p) => p.id !== id && p.name === trimmed);
    if (clash) return null;
    project.name = trimmed;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'project:rename' });
    return project;
  }

  /** @param {string} id */
  deleteProject(id) {
    const project = (this.workspace.projects || []).find((p) => p.id === id);
    const taskIds = new Set((project?.tasks || []).map((t) => t.id));
    this.workspace.projects = (this.workspace.projects || []).filter((p) => p.id !== id);
    const day = this.getCurrentData();
    ['required', 'optional'].forEach((type) => {
      day[type] = (day[type] || []).filter((t) => t.projectId !== id && !taskIds.has(t.id));
    });
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'project:delete' });
  }

  /**
   * Add a required task on the viewed day and a same-id project task.
   * @param {string} projectId
   * @param {string} text
   */
  addProjectTask(projectId, text) {
    const project = (this.workspace.projects || []).find((p) => p.id === projectId);
    if (!project) return null;
    const parsed = parseProjectTitle(text);
    const title = (parsed ? parsed.text : String(text || '')).trim();
    if (!title) return null;
    const day = this.getCurrentData();
    const task = createDailyTask(title, this.currentDate, { projectId });
    day.required.push(task);
    this._attachProjectTask(project, task, 'required');
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type: 'required' });
    return task;
  }

  /**
   * Remove the project-side task and the current day's copy. Other days stay.
   * @param {string} projectId
   * @param {string} taskId
   */
  deleteProjectTask(projectId, taskId) {
    const project = (this.workspace.projects || []).find((p) => p.id === projectId);
    if (project) project.tasks = (project.tasks || []).filter((t) => t.id !== taskId);
    const day = this.getCurrentData();
    ['required', 'optional'].forEach((type) => {
      day[type] = (day[type] || []).filter((t) => t.id !== taskId);
    });
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { id: taskId });
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  toggleTask(type, id) {
    const data = this.getCurrentData();
    const task = data[type].find((t) => t.id === id);
    if (!task) return null;
    task.completed = !task.completed;
    this._mirrorTaskCompleted(id, task.completed);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    if (task.completed) {
      this.eventBus.emit(Events.TASK_COMPLETED, {
        dateKey: this.getDateKey(),
        type,
        id
      });
    }
    return task;
  }

  /**
   * Toggle a task on one stored day without changing the viewed day.
   * The project copy, and the viewed day's copy when it shares the id, stay in sync.
   * @param {string} dateKey
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  toggleTaskOnDate(dateKey, type, id) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
    const day = this.scheduleRepo.ensureDay(this.data, dateKey);
    const task = (day[type] || []).find((item) => item.id === id);
    if (!task) return null;
    task.completed = !task.completed;
    this._mirrorTaskCompleted(id, task.completed);
    if (dateKey !== this.getDateKey()) {
      const daily = this._findDailyTask(id);
      if (daily && daily.type === type) daily.task.completed = task.completed;
    }
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id, dateKey });
    if (task.completed) {
      this.eventBus.emit(Events.TASK_COMPLETED, { dateKey, type, id });
    }
    return task;
  }

  /**
   * Flip the project task, then the current day's copy when one exists.
   * @param {string} projectId
   * @param {string} taskId
   */
  toggleProjectTask(projectId, taskId) {
    const found = this._findProjectTask(projectId, taskId);
    if (!found) return null;
    found.task.completed = !found.task.completed;
    const daily = this._findDailyTask(taskId);
    if (daily) daily.task.completed = found.task.completed;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { id: taskId });
    if (found.task.completed) {
      this.eventBus.emit(Events.TASK_COMPLETED, {
        dateKey: this.getDateKey(),
        type: daily ? daily.type : found.task.list,
        id: taskId
      });
    }
    return found.task;
  }

  pinTask(type, id) {
    const data = this.getCurrentData();
    const task = data[type].find((t) => t.id === id);
    if (!task) return;
    task.pinned = !task.pinned;
    sortTasks(data[type]);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
  }

  deleteTask(type, id) {
    const data = this.getCurrentData();
    data[type] = data[type].filter((t) => t.id !== id);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
  }

  updateTask(type, id, patch) {
    const data = this.getCurrentData();
    const task = data[type].find((t) => t.id === id);
    if (!task) return null;
    if (patch.subtasks !== undefined) {
      patch = { ...patch, subtasks: normalizeSubtasks(patch.subtasks) };
    }
    if (patch.text != null) {
      const parsed = parseProjectTitle(patch.text);
      if (parsed) {
        const project = this.ensureProject(parsed.name);
        patch = { ...patch, text: parsed.text, projectId: project ? project.id : task.projectId };
        if (project) this._attachProjectTask(project, { ...task, text: parsed.text, projectId: project.id }, type);
      } else {
        patch = { ...patch, text: String(patch.text).trim(), projectId: '' };
      }
    }
    Object.assign(task, patch);
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    this._mirrorContentToProject(task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return task;
  }

  /**
   * Edit the project copy. The viewed day's same-id row follows. Other days stay.
   * @param {string} projectId
   * @param {string} taskId
   * @param {{ text?: string, note?: string }} patch
   */
  updateProjectTask(projectId, taskId, patch) {
    const found = this._findProjectTask(projectId, taskId);
    if (!found) return null;
    if (patch.text != null) {
      const parsed = parseProjectTitle(patch.text);
      const title = (parsed ? parsed.text : String(patch.text)).trim();
      if (!title) return null;
      found.task.text = title;
    }
    if (patch.note != null) found.task.note = String(patch.note);
    this._mirrorContentToDaily(found.task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { id: taskId });
    return found.task;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @returns {any|null}
   */
  _findTask(type, taskId) {
    const data = this.getCurrentData();
    const task = (data[type] || []).find((t) => t.id === taskId);
    if (!task) return null;
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    return task;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {string} text
   */
  addSubtask(type, taskId, text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    const task = this._findTask(type, taskId);
    if (!task) return null;
    const sub = createSubtask(trimmed);
    task.subtasks.push(sub);
    this._mirrorContentToProject(task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId });
    return sub;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {string} subId
   */
  toggleSubtask(type, taskId, subId) {
    const task = this._findTask(type, taskId);
    if (!task) return null;
    const sub = task.subtasks.find((s) => s.id === subId);
    if (!sub) return null;
    sub.completed = !sub.completed;
    this._mirrorSubtaskCompleted(taskId, subId, sub.completed);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId });
    return sub;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {string} subId
   * @param {string} text
   */
  updateSubtask(type, taskId, subId, text) {
    const task = this._findTask(type, taskId);
    if (!task) return null;
    const sub = task.subtasks.find((s) => s.id === subId);
    if (!sub) return null;
    const trimmed = String(text || '').trim();
    if (!trimmed) return sub;
    sub.text = trimmed;
    this._mirrorContentToProject(task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId });
    return sub;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {string} subId
   */
  deleteSubtask(type, taskId, subId) {
    const task = this._findTask(type, taskId);
    if (!task) return;
    task.subtasks = task.subtasks.filter((s) => s.id !== subId);
    this._mirrorContentToProject(task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId });
  }

  /**
   * @param {'required'|'optional'} fromType
   * @param {string} id
   * @param {'required'|'optional'} toType
   */
  moveTask(fromType, id, toType) {
    this.placeTask(fromType, id, toType, null);
  }

  /**
   * 按当前查看日的数组顺序摆放。beforeId 为空时放到目标列末尾。
   * @param {'required'|'optional'} fromType
   * @param {string} id
   * @param {'required'|'optional'} toType
   * @param {string|null} beforeId
   */
  placeTask(fromType, id, toType, beforeId) {
    const data = this.getCurrentData();
    const fromList = data[fromType];
    if (!fromList || !data[toType]) return;
    const fromIdx = fromList.findIndex((task) => task.id === id);
    if (fromIdx === -1) return;
    if (fromType === toType && beforeId === id) return;
    const [task] = fromList.splice(fromIdx, 1);
    const toList = data[toType];
    let insertAt = toList.length;
    if (beforeId) {
      const beforeIdx = toList.findIndex((item) => item.id === beforeId);
      if (beforeIdx !== -1) insertAt = beforeIdx;
    }
    toList.splice(insertAt, 0, task);
    if (fromType !== toType) {
      const projectTask = this._findProjectTaskById(id);
      if (projectTask) projectTask.list = toType;
    }
    this.persist();
    if (fromType !== toType) this.eventBus.emit(Events.TASK_MOVED, { fromType, toType, id });
    this.eventBus.emit(Events.TASKS_UPDATED, {});
  }

  /**
   * Remove daily task and return it (for defer to ideas).
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  takeTask(type, id) {
    const data = this.getCurrentData();
    const idx = data[type].findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const [task] = data[type].splice(idx, 1);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return task;
  }

  /**
   * Insert a task into today's list (e.g. pick up from ideas).
   * @param {'required'|'optional'} type
   * @param {import('../domain/schedule/daily-task.js').DailyTask} task
   */
  insertTask(type, task) {
    const data = this.getCurrentData();
    if (data[type].some((t) => t.id === task.id)) return;
    data[type].push(task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type });
  }

  /**
   * Unfinished required/optional on a stored day.
   * @param {string} dateKey
   * @returns {number}
   */
  countOpenTasks(dateKey) {
    const day = this.data[dateKey];
    if (!day) return 0;
    const open = (list) => (Array.isArray(list) ? list.filter((t) => t && !t.completed).length : 0);
    return open(day.required) + open(day.optional);
  }

  /**
   * Days other than the viewed day that still have unfinished required/optional.
   * Newest first.
   * @returns {{ dateKey: string, openCount: number }[]}
   */
  listSyncSources() {
    const currentKey = this.getDateKey();
    return Object.keys(this.data)
      .filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey !== currentKey)
      .map((dateKey) => ({ dateKey, openCount: this.countOpenTasks(dateKey) }))
      .filter((row) => row.openCount > 0)
      .sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
  }

  /**
   * Copy unfinished required/optional from a chosen day onto the viewed day.
   * Same task id. Completed tasks, ideas, projects, and milestones stay put.
   * @param {string} sourceKey
   * @returns {boolean}
   */
  syncTasksFrom(sourceKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceKey || '')) return false;
    if (sourceKey === this.getDateKey()) return false;
    const source = this.data[sourceKey];
    if (!source) return false;
    const data = this.getCurrentData();
    syncPrevDay(source, data);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, {});
    return true;
  }

  /** Manual only: unfinished required/optional from the day before the viewed day. */
  syncPrevDayTasks() {
    return this.syncTasksFrom(getDateKey(addDays(this.currentDate, -1)));
  }

  /**
   * @param {import('../data/workspace-record.js').ProjectRecord} project
   * @param {import('../domain/schedule/daily-task.js').DailyTask} daily
   * @param {'required'|'optional'} list
   */
  _attachProjectTask(project, daily, list) {
    if (!Array.isArray(project.tasks)) project.tasks = [];
    const existing = this._findProjectTaskById(daily.id);
    if (existing) {
      if (existing !== project.tasks.find((t) => t.id === daily.id)) {
        this.workspace.projects.forEach((p) => {
          if (!p || p.id === project.id) return;
          p.tasks = (p.tasks || []).filter((t) => t.id !== daily.id);
        });
        if (!project.tasks.some((t) => t.id === daily.id)) project.tasks.push(existing);
      }
      existing.list = list;
      return existing;
    }
    const copy = {
      id: daily.id,
      text: daily.text || '',
      completed: !!daily.completed,
      note: daily.note || '',
      time: typeof daily.time === 'number' ? daily.time : Date.now(),
      pinned: !!daily.pinned,
      recurrence: daily.recurrence || '',
      subtasks: normalizeSubtasks(daily.subtasks).map((s) => ({ ...s })),
      list
    };
    project.tasks.push(copy);
    return copy;
  }

  /**
   * @param {string} taskId
   * @returns {import('../data/workspace-record.js').ProjectTaskRecord|null}
   */
  _findProjectTaskById(taskId) {
    for (const project of this.workspace.projects || []) {
      const task = (project.tasks || []).find((t) => t.id === taskId);
      if (task) return task;
    }
    return null;
  }

  /**
   * @param {string} projectId
   * @param {string} taskId
   */
  _findProjectTask(projectId, taskId) {
    const project = (this.workspace.projects || []).find((p) => p.id === projectId);
    if (!project) return null;
    const task = (project.tasks || []).find((t) => t.id === taskId);
    if (!task) return null;
    return { project, task };
  }

  /**
   * @param {string} taskId
   * @returns {{ type: 'required'|'optional', task: import('../domain/schedule/daily-task.js').DailyTask }|null}
   */
  _findDailyTask(taskId) {
    const day = this.getCurrentData();
    for (const type of /** @type {const} */ (['required', 'optional'])) {
      const task = (day[type] || []).find((t) => t.id === taskId);
      if (task) return { type, task };
    }
    return null;
  }

  /**
   * @param {string} taskId
   * @param {boolean} completed
   */
  _mirrorTaskCompleted(taskId, completed) {
    const task = this._findProjectTaskById(taskId);
    if (task) task.completed = completed;
  }

  /**
   * @param {string} taskId
   * @param {string} subId
   * @param {boolean} completed
   */
  _mirrorSubtaskCompleted(taskId, subId, completed) {
    const task = this._findProjectTaskById(taskId);
    const sub = task && (task.subtasks || []).find((s) => s.id === subId);
    if (sub) sub.completed = completed;
  }

  /**
   * Copy title, note, and subtasks onto the project row with the same id.
   * @param {import('../domain/schedule/daily-task.js').DailyTask|null|undefined} daily
   */
  _mirrorContentToProject(daily) {
    if (!daily?.projectId) return;
    const projectTask = this._findProjectTaskById(daily.id);
    if (!projectTask) return;
    projectTask.text = daily.text || '';
    projectTask.note = daily.note || '';
    projectTask.subtasks = normalizeSubtasks(daily.subtasks).map((sub) => ({ ...sub }));
  }

  /**
   * Copy title, note, and subtasks onto the viewed day's row. Other days stay.
   * @param {{ id: string, text?: string, note?: string, subtasks?: any[] }} projectTask
   */
  _mirrorContentToDaily(projectTask) {
    const daily = this._findDailyTask(projectTask.id);
    if (!daily) return;
    daily.task.text = projectTask.text || '';
    daily.task.note = projectTask.note || '';
    daily.task.subtasks = normalizeSubtasks(projectTask.subtasks).map((sub) => ({ ...sub }));
  }

  /**
   * @param {string} projectId
   * @param {string} taskId
   * @param {string} text
   */
  addProjectSubtask(projectId, taskId, text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    const found = this._findProjectTask(projectId, taskId);
    if (!found) return null;
    if (!Array.isArray(found.task.subtasks)) found.task.subtasks = [];
    const sub = createSubtask(trimmed);
    found.task.subtasks.push(sub);
    this._mirrorContentToDaily(found.task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { id: taskId });
    return sub;
  }

  /**
   * @param {string} projectId
   * @param {string} taskId
   * @param {string} subId
   */
  toggleProjectSubtask(projectId, taskId, subId) {
    const found = this._findProjectTask(projectId, taskId);
    if (!found) return null;
    const sub = (found.task.subtasks || []).find((s) => s.id === subId);
    if (!sub) return null;
    sub.completed = !sub.completed;
    const daily = this._findDailyTask(taskId);
    const dailySub = daily && (daily.task.subtasks || []).find((s) => s.id === subId);
    if (dailySub) dailySub.completed = sub.completed;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { id: taskId });
    return sub;
  }

  /**
   * @param {string} projectId
   * @param {string} taskId
   * @param {string} subId
   */
  deleteProjectSubtask(projectId, taskId, subId) {
    const found = this._findProjectTask(projectId, taskId);
    if (!found) return;
    found.task.subtasks = (found.task.subtasks || []).filter((s) => s.id !== subId);
    this._mirrorContentToDaily(found.task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { id: taskId });
  }

  clearTodayTasks() {
    const data = this.getCurrentData();
    data.required = [];
    data.optional = [];
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, {});
  }

  setReflection(text) {
    const data = this.getCurrentData();
    data.reflection = text;
    this.persist();
    this.eventBus.emit(Events.REFLECTION_UPDATED, {});
  }

  toggleReflectionTag(tag) {
    const data = this.getCurrentData();
    const tags = data.reflectionTags || [];
    const idx = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(tag);
    data.reflectionTags = tags;
    this.persist();
    this.eventBus.emit(Events.REFLECTION_UPDATED, {});
  }

  setAiEval(text) {
    const data = this.getCurrentData();
    data.aiEval = typeof text === 'string' ? text : '';
    this.persist();
  }

  getProgress() {
    const data = this.getCurrentData();
    const allTasks = data.required || [];
    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }

  /**
   * Incomplete required/optional on the currently viewed day only.
   * @returns {Array<{ dateKey: string, list: 'required'|'optional', task: any }>}
   */
  listIncompleteDailyTasks() {
    const dateKey = this.getDateKey();
    const day = this.getCurrentData();
    /** @type {Array<{ dateKey: string, list: 'required'|'optional', task: any }>} */
    const out = [];
    ['required', 'optional'].forEach((list) => {
      (day[list] || []).forEach((task) => {
        if (!task.completed) out.push({ dateKey, list: /** @type {any} */ (list), task });
      });
    });
    return out;
  }

  parseTime = parseTime;
  todayKey = todayKey;
}
