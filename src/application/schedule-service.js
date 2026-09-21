import { getDateKey, addDays, todayKey } from '../domain/shared/date-key.js';
import { createDailyTask, sortTasks, parseTime } from '../domain/schedule/daily-task.js';
import {
  syncPrevDayTasks,
  computeStreakDays,
  createEmptyScheduleDay
} from '../domain/schedule/schedule-day.js';
import { Events } from './event-bus.js';

export class ScheduleService {
  /**
   * @param {object} deps
   * @param {import('../infrastructure/storage/schedule-repository.js').ScheduleRepository} deps.scheduleRepo
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ scheduleRepo, eventBus }) {
    this.scheduleRepo = scheduleRepo;
    this.eventBus = eventBus;
    /** @type {Record<string, any>} */
    this.data = {};
    this.currentDate = new Date();
  }

  load() {
    this.data = this.scheduleRepo.load();
  }

  persist() {
    this.scheduleRepo.save(this.data);
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
    const data = this.getCurrentData();
    const task = createDailyTask(text, this.currentDate);
    data[type].push(task);
    sortTasks(data[type]);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type });
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
    Object.assign(task, patch);
    if (patch.time != null) sortTasks(data[type]);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return task;
  }

  /**
   * @param {'required'|'optional'} fromType
   * @param {string} id
   * @param {'required'|'optional'} toType
   */
  moveTask(fromType, id, toType) {
    if (fromType === toType) return;
    const data = this.getCurrentData();
    const list = data[fromType];
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [task] = list.splice(idx, 1);
    data[toType].push(task);
    sortTasks(data[toType]);
    this.persist();
    this.eventBus.emit(Events.TASK_MOVED, { fromType, toType, id });
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
    sortTasks(data[type]);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type });
  }

  /** Manual only: unfinished required/optional from yesterday → current day.
   *  Day-scoped ideas / milestones are never copied. */
  syncPrevDayTasks() {
    const prevKey = getDateKey(addDays(this.currentDate, -1));
    const prevData = this.data[prevKey];
    if (!prevData) return;
    const data = this.getCurrentData();
    syncPrevDayTasks(prevData, data);
    sortTasks(data.required);
    sortTasks(data.optional);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, {});
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

  getStreakDays() {
    return computeStreakDays(this.data, getDateKey);
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
