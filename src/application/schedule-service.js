import { createEmptyWorkspace } from '../data/workspace-record.js';
import { getDateKey, addDays, todayKey, shiftDateKey } from '../domain/shared/date-key.js';
import { createNote, parseTime, normalizeNotes, normalizeTagIds } from '../domain/schedule/daily-task.js';
import { nextTagColor } from '../domain/schedule/tag-palette.js';
import { fallbackGroupTitle } from '../domain/schedule/task-group.js';
import {
  adoptScheduleTask,
  clearScheduleDay,
  covers,
  dissolveGroup,
  earliestStart,
  extendScheduleRange,
  findScheduleGroup,
  findScheduleTask,
  insertScheduleTask,
  nestScheduleTasks,
  newScheduleId,
  placeScheduleTask,
  projectDay,
  removeScheduleTask,
  renameScheduleGroup,
  setScheduleCompleted,
  syncScheduleRange,
  toggleSchedulePin
} from '../domain/schedule/schedule-document.js';
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
    /** @type {import('../domain/schedule/schedule-document.js').ScheduleDocument} */
    this.data = { tasks: [], groups: [], order: { required: [], optional: [] } };
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

  /** 当前查看日上看得到的必做和选做。分组画成带 children 的框。 */
  getCurrentData() {
    return projectDay(this.data, this.getDateKey());
  }

  /** @param {string} dateKey */
  day(dateKey) {
    return projectDay(this.data, dateKey);
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
   * 新建任务放在该列最上方，开始日和截止日都是当前查看日。
   * @param {'required'|'optional'} type
   * @param {string} text
   * @param {string|string[]} [tagIds]
   */
  addTask(type, text, tagIds = []) {
    const title = String(text || '').trim();
    if (!title || (type !== 'required' && type !== 'optional')) return null;
    const now = new Date();
    const task = {
      id: newScheduleId(),
      text: title,
      completed: false,
      pinned: false,
      recurrence: '',
      tagIds: this._knownTagIds(tagIds),
      notes: [],
      list: type,
      start: this.getDateKey(),
      due: this.getDateKey(),
      minutes: now.getHours() * 60 + now.getMinutes(),
      groupId: ''
    };
    insertScheduleTask(this.data, task);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type });
    return task;
  }

  /**
   * @param {any} task
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

  /**
   * @param {string} name
   * @param {string} [description]
   */
  addTag(name, description = '') {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    if (!Array.isArray(this.workspace.tags)) this.workspace.tags = [];
    if (this.workspace.tags.some((tag) => tag.name === trimmed)) return null;
    const tag = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      description: String(description || '').trim(),
      color: nextTagColor(this.workspace.tags),
      pinned: false
    };
    this.workspace.tags.push(tag);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'tag:add' });
    return tag;
  }

  /**
   * @param {string} id
   * @param {string} name
   * @param {string} [description]
   */
  renameTag(id, name, description) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const tag = this._findTag(id);
    if (!tag) return null;
    if ((this.workspace.tags || []).some((item) => item.id !== id && item.name === trimmed)) return null;
    tag.name = trimmed;
    if (description !== undefined) tag.description = String(description || '').trim();
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'tag:rename' });
    return tag;
  }

  /**
   * @param {string} id
   */
  deleteTag(id) {
    const tag = this._findTag(id);
    if (!tag) return false;
    this.workspace.tags = (this.workspace.tags || []).filter((item) => item.id !== id);
    this.data.tasks.forEach((task) => {
      task.tagIds = normalizeTagIds(task).filter((item) => item !== id);
    });
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'tag:delete' });
    return true;
  }

  /**
   * @param {string} id
   */
  toggleTagPin(id) {
    const tag = this._findTag(id);
    if (!tag) return null;
    tag.pinned = !tag.pinned;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { reason: 'tag:pin' });
    return tag;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {string} name
   * @param {string} [dateKey]
   * @param {string} [description]
   */
  attachTagNamed(type, taskId, name, dateKey = this.getDateKey(), description = '') {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const task = findScheduleTask(this.data, taskId);
    if (!task || task.list !== type) return null;
    let tag = (this.workspace.tags || []).find((item) => item.name === trimmed) || null;
    if (!tag) {
      tag = this.addTag(trimmed, description);
      if (!tag) return null;
    }
    const ids = normalizeTagIds(task);
    if (!ids.includes(tag.id)) ids.push(tag.id);
    task.tagIds = this._knownTagIds(ids);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId });
    return task;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} id
   * @param {string|string[]} tagIds
   */
  setTaskTag(type, id, tagIds) {
    const task = this._findTask(type, id);
    if (!task) return null;
    task.tagIds = this._knownTagIds(tagIds);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return task;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  toggleTask(type, id) {
    return this._toggleOn(this.getDateKey(), type, id);
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  toggleTaskOnDate(dateKey, type, id) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
    return this._toggleOn(dateKey, type, id);
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  _toggleOn(dateKey, type, id) {
    const group = findScheduleGroup(this.data, id);
    const task = findScheduleTask(this.data, id);
    if (group) {
      if (group.list !== type) return null;
      const visible = group.childIds
        .map((childId) => findScheduleTask(this.data, childId))
        .filter((child) => child && covers(child, dateKey));
      if (!visible.length) return null;
      const completed = setScheduleCompleted(this.data, id, dateKey, visible.some((child) => !child.completed));
      this.persist();
      this.eventBus.emit(Events.TASKS_UPDATED, { type, id, dateKey });
      completed.forEach((completedId) => this.eventBus.emit(Events.TASK_COMPLETED, { dateKey, type, id: completedId }));
      return projectDay(this.data, dateKey)[type].find((row) => row.id === id) || null;
    }
    if (!task || task.list !== type || !covers(task, dateKey)) return null;
    const completed = setScheduleCompleted(this.data, id, dateKey, !task.completed);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id, dateKey });
    completed.forEach((completedId) => this.eventBus.emit(Events.TASK_COMPLETED, { dateKey, type, id: completedId }));
    return task;
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  completeTaskOnDate(dateKey, type, id) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
    const task = findScheduleTask(this.data, id);
    if (!task || task.list !== type || !covers(task, dateKey)) return null;
    if (task.completed) return task;
    const completed = setScheduleCompleted(this.data, id, dateKey, true);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id, dateKey });
    completed.forEach((completedId) => this.eventBus.emit(Events.TASK_COMPLETED, { dateKey, type, id: completedId }));
    return task;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  pinTask(type, id) {
    const task = findScheduleTask(this.data, id);
    if (!task || task.list !== type) return;
    toggleSchedulePin(this.data, id);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  deleteTask(type, id) {
    const group = findScheduleGroup(this.data, id);
    if (group && group.list === type) {
      dissolveGroup(this.data, id);
      this.persist();
      this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
      return;
    }
    const task = findScheduleTask(this.data, id);
    if (!task || task.list !== type) return;
    removeScheduleTask(this.data, id);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} id
   * @param {object} patch
   */
  updateTask(type, id, patch) {
    const task = this._findTask(type, id);
    if (!task) return null;
    this._applyTaskPatch(task, patch);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return task;
  }

  /**
   * 把任务收成只出现在指定那一天，并套上其余修改。
   * @param {'required'|'optional'} type
   * @param {string} id
   * @param {string} dateKey
   * @param {object} patch
   */
  moveTaskToDate(type, id, dateKey, patch) {
    if (type !== 'required' && type !== 'optional') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
    const task = this._findTask(type, id);
    if (!task) return null;
    this._applyTaskPatch(task, { ...(patch || {}), start: dateKey, due: dateKey });
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id, dateKey });
    return task;
  }

  /**
   * @param {import('../domain/schedule/schedule-document.js').ScheduleTask} task
   * @param {object} patch
   */
  _applyTaskPatch(task, patch) {
    let next = patch || {};
    if (next.notes !== undefined || next.note !== undefined || next.subtasks !== undefined) {
      next = { ...next, notes: normalizeNotes(next.notes, { note: next.note, subtasks: next.subtasks }) };
      delete next.note;
      delete next.subtasks;
    }
    if (next.text != null) {
      const text = String(next.text).trim();
      if (text) next = { ...next, text };
      else delete next.text;
    }
    if (next.tagIds != null || next.tagId != null) {
      next = { ...next, tagIds: this._knownTagIds(next.tagIds != null ? next.tagIds : next.tagId) };
      delete next.tagId;
    }
    if (next.start != null || next.due !== undefined) {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(next.start || '') ? next.start : task.start;
      const due = next.due === '' || next.due == null
        ? (next.due === '' ? '' : task.due)
        : (/^\d{4}-\d{2}-\d{2}$/.test(next.due) ? next.due : task.due);
      if (!due || start <= due) {
        task.start = start;
        task.due = due;
      }
      delete next.start;
      delete next.due;
    }
    if (next.minutes != null) {
      const minutes = Number(next.minutes);
      if (Number.isInteger(minutes)) task.minutes = Math.min(1439, Math.max(0, minutes));
      delete next.minutes;
    }
    if (next.recurrence != null) task.recurrence = String(next.recurrence || '');
    delete next.recurrence;
    Object.assign(task, next);
    delete task.tagId;
    delete task.note;
    delete task.subtasks;
    delete task.children;
    if (!Array.isArray(task.notes)) task.notes = [];
    if (!String(task.text || '').trim()) task.text = task.text;
    return task;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   */
  _findTask(type, taskId) {
    const task = findScheduleTask(this.data, taskId);
    if (!task || task.list !== type) return null;
    if (!Array.isArray(task.notes)) task.notes = normalizeNotes(task.notes, task);
    return task;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {string} text
   */
  addNote(type, taskId, text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    const task = this._findTask(type, taskId);
    if (!task) return null;
    const note = createNote(trimmed);
    task.notes.push(note);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId });
    return note;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {string} noteId
   */
  deleteNote(type, taskId, noteId) {
    const task = this._findTask(type, taskId);
    if (!task) return;
    task.notes = task.notes.filter((item) => item.id !== noteId);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId });
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {Array<{ id?: string, text?: string }>} notes
   */
  setTaskNotes(dateKey, type, taskId, notes) {
    return this.updateTaskOnDate(dateKey, type, taskId, { notes });
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @param {object} patch
   */
  updateTaskOnDate(dateKey, type, taskId, patch) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
    const task = this._findTask(type, taskId);
    if (!task || !covers(task, dateKey)) return null;
    this._applyTaskPatch(task, patch);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: taskId, dateKey });
    return task;
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
   * @param {'required'|'optional'} type
   * @param {string} targetId
   * @param {string} draggedId
   */
  nestTasks(type, targetId, draggedId) {
    const nested = nestScheduleTasks(this.data, type, targetId, draggedId);
    if (!nested) return null;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: nested.id });
    return { ...nested, text: nested.title, children: nested.childIds.map((id) => findScheduleTask(this.data, id)) };
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} groupId
   * @param {string} draggedId
   */
  adoptTask(type, groupId, draggedId) {
    const group = findScheduleGroup(this.data, groupId);
    if (!group || group.list !== type) return null;
    const adopted = adoptScheduleTask(this.data, groupId, draggedId);
    if (!adopted) return null;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: groupId });
    return adopted;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} groupId
   * @param {string} text
   * @param {string} fallback
   */
  renameGroupIfFallback(type, groupId, text, fallback) {
    const group = findScheduleGroup(this.data, groupId);
    if (!group || group.list !== type || group.title !== fallback) return null;
    const renamed = renameScheduleGroup(this.data, groupId, text);
    if (!renamed) return null;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: groupId });
    return renamed;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} groupId
   * @param {string} title
   */
  renameGroup(type, groupId, title) {
    const group = findScheduleGroup(this.data, groupId);
    if (!group || group.list !== type) return null;
    const previous = group.title;
    const renamed = renameScheduleGroup(this.data, groupId, title);
    if (!renamed || !String(title || '').trim()) {
      group.title = previous;
      return group;
    }
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id: groupId });
    return renamed;
  }

  /**
   * @param {'required'|'optional'} fromType
   * @param {string} id
   * @param {'required'|'optional'} toType
   * @param {string|null} beforeId
   */
  placeTask(fromType, id, toType, beforeId) {
    if (fromType === toType && beforeId === id) return;
    const ok = placeScheduleTask(this.data, fromType, id, toType, beforeId, this.getDateKey());
    if (!ok) return;
    this.persist();
    if (fromType !== toType) this.eventBus.emit(Events.TASK_MOVED, { fromType, toType, id });
    this.eventBus.emit(Events.TASKS_UPDATED, {});
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} id
   */
  takeTask(type, id) {
    const task = findScheduleTask(this.data, id);
    if (!task || task.list !== type) return null;
    const copy = { ...task, notes: task.notes.map((note) => ({ ...note })), tagIds: [...task.tagIds] };
    removeScheduleTask(this.data, id);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, id });
    return copy;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {any} task
   */
  insertTask(type, task) {
    return this.insertTaskOnDate(this.getDateKey(), type, task);
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} type
   * @param {any} task
   */
  insertTaskOnDate(dateKey, type, task) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return;
    if (type !== 'required' && type !== 'optional') return;
    if (findScheduleTask(this.data, task?.id)) return;
    const clock = typeof task?.time === 'number' ? new Date(task.time) : new Date();
    const stored = {
      id: task?.id || newScheduleId(),
      text: String(task?.text || ''),
      completed: !!task?.completed,
      pinned: !!task?.pinned,
      recurrence: task?.recurrence || '',
      tagIds: this._knownTagIds(normalizeTagIds(task)),
      notes: normalizeNotes(task?.notes, { note: task?.note, subtasks: task?.subtasks }),
      list: type,
      start: dateKey,
      due: dateKey,
      minutes: Number.isInteger(task?.minutes) ? task.minutes : clock.getHours() * 60 + clock.getMinutes(),
      groupId: ''
    };
    insertScheduleTask(this.data, stored);
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, { type, dateKey });
  }

  /**
   * @param {string} dateKey
   * @returns {number}
   */
  countOpenTasks(dateKey) {
    return this.data.tasks.filter((task) => !task.completed && covers(task, dateKey)).length;
  }

  /** @returns {{ dateKey: string, openCount: number }[]} */
  listSyncSources() {
    const currentKey = this.getDateKey();
    /** @type {Map<string, number>} */
    const counts = new Map();
    this.data.tasks.forEach((task) => {
      if (task.completed) return;
      const end = task.due || task.start;
      let cursor = task.start;
      let guard = 0;
      while (cursor && cursor <= end && guard < 4000) {
        if (cursor !== currentKey) counts.set(cursor, (counts.get(cursor) || 0) + 1);
        cursor = shiftDateKey(cursor, 1);
        guard += 1;
      }
    });
    return [...counts.entries()]
      .map(([dateKey, openCount]) => ({ dateKey, openCount }))
      .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  }

  /**
   * 把来源日上未完成、而且今天还看不到的任务，把区间扩到盖住今天。
   * @param {string} sourceKey
   */
  syncTasksFrom(sourceKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceKey || '')) return false;
    const target = this.getDateKey();
    if (sourceKey === target) return false;
    const changed = syncScheduleRange(this.data, sourceKey, target);
    if (!changed) return false;
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, {});
    return true;
  }

  syncPrevDayTasks() {
    return this.syncTasksFrom(getDateKey(addDays(this.currentDate, -1)));
  }

  clearDayTasks() {
    clearScheduleDay(this.data, this.getDateKey());
    this.persist();
    this.eventBus.emit(Events.TASKS_UPDATED, {});
  }

  getProgress() {
    const key = this.getDateKey();
    const leaves = this.data.tasks.filter((task) => task.list === 'required' && covers(task, key));
    const total = leaves.length;
    const completed = leaves.filter((task) => task.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }

  listIncompleteDailyTasks() {
    const dateKey = this.getDateKey();
    return this.listIncompleteOnDate(dateKey).map(({ list, task }) => ({ dateKey, list, task }));
  }

  /**
   * @param {string} dateKey
   * @returns {Array<{ list: 'required'|'optional', task: any }>}
   */
  listIncompleteOnDate(dateKey) {
    return this.data.tasks
      .filter((task) => !task.completed && covers(task, dateKey))
      .map((task) => ({ list: task.list, task }));
  }

  /**
   * @param {string} dateKey
   * @param {'required'|'optional'} list
   * @param {string} taskId
   */
  findTaskOnDate(dateKey, list, taskId) {
    const task = findScheduleTask(this.data, taskId);
    if (!task || task.list !== list || !covers(task, dateKey)) return null;
    return task;
  }

  /** 分组标题仍是两条任务名截出来的那句时，才换成模型给出的标题。 */
  fallbackGroupTitle(texts) {
    return fallbackGroupTitle(texts);
  }

  parseTime = parseTime;
  todayKey = todayKey;
  earliestStart = () => earliestStart(this.data);
  extendRange = extendScheduleRange;
}
