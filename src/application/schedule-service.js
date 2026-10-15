import { createEmptyWorkspace } from '../data/workspace-record.js';
import { getDateKey, addDays, todayKey } from '../domain/shared/date-key.js';
import { createDailyTask, createSubtask, sortTasks, parseTime, normalizeSubtasks, normalizeTagIds } from '../domain/schedule/daily-task.js';
import { nextTagColor } from '../domain/schedule/tag-palette.js';
import { ensureFixedTags, isFixedTag } from '../domain/schedule/fixed-tags.js';
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
    const tags = ensureFixedTags(this.workspace.tags);
    const before = JSON.stringify(this.workspace.tags || []);
    if (JSON.stringify(tags) !== before) {
      this.workspace.tags = tags;
      this.workspaceRepo.save(this.workspace);
    }
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
  /**
   * @param {'required'|'optional'} type
   * @param {string} text
   * @param {string|string[]} [tagIds]
   */
  addTask(type, text, tagIds = []) {
    const title = String(text || '').trim();
    if (!title) return null;
    const data = this.getCurrentData();
    const task = createDailyTask(title, this.currentDate, { tagIds: this._knownTagIds(tagIds) });
    data[type].push(task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type });
    return task;
  }

  /**
   * @param {import('../domain/schedule/daily-task.js').DailyTask|null|undefined} task
   * @returns {string}
   */
  taskTitle(task) {
    return task?.text || '';
  }

  /**
   * @param {string} id
   * @returns {import('../data/workspace-record.js').TagRecord|null}
   */
  _findTag(id) {
    if (!id) return null;
    return (this.workspace.tags || []).find((tag) => tag.id === id) || null;
  }

  /**
   * Keep only ids that exist in the catalog, in the order given.
   * @param {string|string[]} raw
   * @returns {string[]}
   */
  _knownTagIds(raw) {
    const seen = new Set();
    return normalizeTagIds(Array.isArray(raw) ? { tagIds: raw } : { tagId: raw }).filter((id) => {
      if (seen.has(id) || !this._findTag(id)) return false;
      seen.add(id);
      return true;
    });
  }

  /** @param {string} name */
  addTag(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    if (!Array.isArray(this.workspace.tags)) this.workspace.tags = [];
    if (this.workspace.tags.some((tag) => tag.name === trimmed)) return null;
    const tag = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      color: nextTagColor(this.workspace.tags)
    };
    this.workspace.tags.push(tag);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'tag:add' });
    return tag;
  }

  /**
   * @param {string} id
   * @param {string} name
   */
  renameTag(id, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const tag = this._findTag(id);
    if (!tag || isFixedTag(tag)) return null;
    if ((this.workspace.tags || []).some((item) => item.id !== id && item.name === trimmed)) return null;
    tag.name = trimmed;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'tag:rename' });
    return tag;
  }

  /**
   * Drop the tag everywhere. Tasks stay, only the mark is cleared.
   * @param {string} id
   */
  deleteTag(id) {
    const tag = this._findTag(id);
    if (!tag || isFixedTag(tag)) return false;
    this.workspace.tags = (this.workspace.tags || []).filter((tag) => tag.id !== id);
    Object.keys(this.data || {}).forEach((dateKey) => {
      const day = this.data[dateKey];
      ['required', 'optional'].forEach((type) => {
        (day?.[type] || []).forEach((task) => {
          if (!task) return;
          task.tagIds = normalizeTagIds(task).filter((item) => item !== id);
          delete task.tagId;
        });
      });
    });
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'tag:delete' });
    return true;
  }

  /**
   * Replace the tags on the viewed day's copy only.
   * @param {'required'|'optional'} type
   * @param {string} id
   * @param {string|string[]} tagIds
   */
  setTaskTag(type, id, tagIds) {
    const data = this.getCurrentData();
    const task = (data[type] || []).find((item) => item.id === id);
    if (!task) return null;
    task.tagIds = this._knownTagIds(tagIds);
    delete task.tagId;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return task;
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
   * Toggle a task on one stored day. Other days stay as they are.
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
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id, dateKey });
    if (task.completed) {
      this.eventBus.emit(Events.TASK_COMPLETED, { dateKey, type, id });
    }
    return task;
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
      patch = { ...patch, text: String(patch.text).trim() };
    }
    if (patch.tagIds != null || patch.tagId != null) {
      const ids = this._knownTagIds(patch.tagIds != null ? patch.tagIds : patch.tagId);
      patch = { ...patch, tagIds: ids };
      delete patch.tagId;
    }
    Object.assign(task, patch);
    delete task.tagId;
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return task;
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
    const next = { ...task, tagIds: this._knownTagIds(normalizeTagIds(task)) };
    delete next.tagId;
    delete next.projectId;
    data[type].push(next);
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
   * Same task id. The tag on the task is copied with it. Completed tasks stay on the source day.
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
    return this.listIncompleteOnDate(dateKey).map(({ list, task }) => ({ dateKey, list, task }));
  }

  /**
   * Incomplete required/optional on a specific date (e.g. real today for pomodoro).
   * @param {string} dateKey
   * @returns {Array<{ list: 'required'|'optional', task: any }>}
   */
  listIncompleteOnDate(dateKey) {
    const day = this.scheduleRepo.ensureDay(this.data, dateKey);
    /** @type {Array<{ list: 'required'|'optional', task: any }>} */
    const out = [];
    ['required', 'optional'].forEach((list) => {
      (day[list] || []).forEach((task) => {
        if (!task.completed) out.push({ list: /** @type {any} */ (list), task });
      });
    });
    return out;
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} list
   * @param {string} taskId
   * @returns {any|null}
   */
  findTaskOnDate(dateKey, list, taskId) {
    const day = this.scheduleRepo.ensureDay(this.data, dateKey);
    return (day[list] || []).find((t) => t.id === taskId) || null;
  }

  /**
   * Award one pomodoro on a specific day's task copy.
   * @param {string} dateKey
   * @param {'required'|'optional'} list
   * @param {string} taskId
   * @returns {boolean}
   */
  incrementPomodoro(dateKey, list, taskId) {
    const day = this.scheduleRepo.ensureDay(this.data, dateKey);
    const task = (day[list] || []).find((t) => t.id === taskId);
    if (!task) return false;
    const n = typeof task.pomodoros === 'number' && task.pomodoros > 0 ? Math.floor(task.pomodoros) : 0;
    task.pomodoros = n + 1;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type: list, id: taskId, reason: 'pomodoro' });
    return true;
  }

  /**
   * Toggle a subtask on a specific date's copy. Other dates stay as they are.
   * @param {string} dateKey
   * @param {'required'|'optional'} list
   * @param {string} taskId
   * @param {string} subId
   */
  toggleSubtaskOnDate(dateKey, list, taskId, subId) {
    const day = this.scheduleRepo.ensureDay(this.data, dateKey);
    const task = (day[list] || []).find((t) => t.id === taskId);
    if (!task) return null;
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    const sub = task.subtasks.find((s) => s.id === subId);
    if (!sub) return null;
    sub.completed = !sub.completed;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type: list, id: taskId });
    return sub;
  }

  parseTime = parseTime;
  todayKey = todayKey;
}
