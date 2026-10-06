import { todayKey } from '../domain/shared/date-key.js';
import {
  abandon,
  focusFromTaskRow,
  formatRemaining,
  remainingMs,
  settle,
  skipBreak,
  startWork,
  switchTask
} from '../domain/pomodoro/session.js';
import { Events } from './event-bus.js';

/**
 * One pomodoro round bound to a real today-task.
 * Persists absolute endsAt in ceoPomodoro (not ceoSchedule).
 */
export class PomodoroService {
  /**
   * @param {object} deps
   * @param {import('../infrastructure/storage/pomodoro-repository.js').PomodoroRepository} deps.pomodoroRepo
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   * @param {() => number} [deps.now]
   */
  constructor({ pomodoroRepo, scheduleService, eventBus, now = () => Date.now() }) {
    this.pomodoroRepo = pomodoroRepo;
    this.scheduleService = scheduleService;
    this.eventBus = eventBus;
    this.now = now;
    /** @type {import('../domain/pomodoro/session.js').PomodoroSession|null} */
    this.session = null;
    /** @type {{ taskId: string, list: 'required'|'optional' }|null} */
    this.selected = null;
    /** @type {ReturnType<typeof setTimeout>|ReturnType<typeof setInterval>|null} */
    this._timer = null;
  }

  load() {
    this.session = this.pomodoroRepo.load();
    if (this.session) {
      this.selected = { taskId: this.session.taskId, list: this.session.list };
    }
    this.eventBus.on(Events.TASKS_UPDATED, () => this.onTasksUpdated());
    this.tick();
    this.startTicker();
  }

  persist() {
    this.pomodoroRepo.save(this.session);
  }

  startTicker() {
    if (this._timer != null) return;
    const armInterval = () => {
      this.tick();
      this._timer = setInterval(() => this.tick(), 1000);
    };
    const delay = 1000 - (this.now() % 1000);
    this._timer = setTimeout(armInterval, delay);
  }

  stopTicker() {
    if (this._timer != null) {
      clearTimeout(this._timer);
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  tick() {
    if (this.session) {
      const stillThere = this.scheduleService.findTaskOnDate(
        this.session.dateKey,
        this.session.list,
        this.session.taskId
      );
      if (!stillThere) {
        this.session = abandon(this.session);
        this.persist();
        this._emit();
        return;
      }
    } else if (!this.session) {
      // Idle: still emit once on bootstrap so the sidebar can hide leftover chrome.
    }

    const before = this.session;
    const result = settle(this.session, this.now());
    this.session = result.session;
    if (result.awardPomodoro && result.award) {
      const ok = this.scheduleService.incrementPomodoro(
        result.award.dateKey,
        result.award.list,
        result.award.taskId
      );
      if (!ok) {
        this.session = null;
        this.persist();
        this._emit();
        return;
      }
    }
    if (result.idleTaskId) {
      this.selected = { taskId: result.idleTaskId, list: result.idleList || 'required' };
    }
    if (before !== this.session || result.awardPomodoro || this.session) {
      if (before !== this.session) this.persist();
      this._emit();
    }
  }

  onTasksUpdated() {
    if (!this.session) return;
    const found = this.scheduleService.findTaskOnDate(
      this.session.dateKey,
      this.session.list,
      this.session.taskId
    );
    if (!found) {
      this.session = abandon(this.session);
      this.persist();
      this._emit();
    }
  }

  /** @returns {Array<{ list: 'required'|'optional', task: any }>} */
  listTodayIncomplete() {
    return this.scheduleService.listIncompleteOnDate(todayKey());
  }

  getSnapshot() {
    const now = this.now();
    const rem = remainingMs(this.session, now);
    const phase = this.session ? this.session.phase : 'idle';
    let activeTask = null;
    let activeDateKey = todayKey();
    let activeList = this.selected?.list || 'required';
    let activeId = this.selected?.taskId || '';
    if (this.session) {
      activeDateKey = this.session.dateKey;
      activeList = this.session.list;
      activeId = this.session.taskId;
      activeTask = this.scheduleService.findTaskOnDate(activeDateKey, activeList, activeId);
    } else if (this.selected) {
      activeTask = this.scheduleService.findTaskOnDate(todayKey(), this.selected.list, this.selected.taskId);
    }
    return {
      session: this.session,
      remainingMs: rem,
      remainingLabel: formatRemaining(phase === 'idle' ? 25 * 60 * 1000 : rem),
      selected: this.selected,
      activeTask,
      activeDateKey,
      activeList,
      activeId,
      pendingTaskId: this.session?.pendingTaskId || '',
      phase
    };
  }

  /**
   * Right-list click.
   * @param {'required'|'optional'} list
   * @param {string} taskId
   */
  selectTask(list, taskId) {
    this.tick();
    const dateKey = todayKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, list, taskId);
    if (!task || task.completed) return;

    if (this.session?.phase === 'work') {
      this._switchDuringWork(list, taskId);
      return;
    }
    if (this.session?.phase === 'break') {
      const { session } = switchTask(this.session, { taskId, list, dateKey, now: this.now() });
      this.session = session;
      this.selected = { taskId, list };
      this.persist();
      this._emit();
      return;
    }
    this.selected = { taskId, list };
    this._emit();
  }

  /**
   * @param {'required'|'optional'} [list]
   * @param {string} [taskId]
   */
  start(list, taskId) {
    this.tick();
    const targetList = list || this.selected?.list;
    const targetId = taskId || this.selected?.taskId;
    if (!targetList || !targetId) return;
    const dateKey = todayKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, targetList, targetId);
    if (!task || task.completed) return;

    if (this.session?.phase === 'work') {
      this._switchDuringWork(targetList, targetId);
      return;
    }
    this.session = startWork({
      taskId: targetId,
      list: targetList,
      dateKey,
      now: this.now()
    });
    this.selected = { taskId: targetId, list: targetList };
    this.persist();
    this._emit();
  }

  /**
   * Task-row「专注」.
   * @param {'required'|'optional'} list
   * @param {string} taskId
   */
  focusTask(list, taskId) {
    this.tick();
    const dateKey = todayKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, list, taskId);
    if (!task || task.completed) return;
    this.session = focusFromTaskRow(this.session, {
      taskId,
      list,
      dateKey,
      now: this.now()
    });
    this.selected = { taskId, list };
    this.persist();
    this._emit();
  }

  abandon() {
    this.tick();
    if (!this.session) return;
    if (this.session.phase === 'work') {
      this.selected = { taskId: this.session.taskId, list: this.session.list };
    } else {
      this.selected = {
        taskId: this.session.pendingTaskId || this.session.taskId,
        list: this.session.pendingList || this.session.list
      };
    }
    this.session = abandon(this.session);
    this.persist();
    this._emit();
  }

  skipBreak() {
    this.tick();
    if (!this.session || this.session.phase !== 'break') return;
    this.selected = {
      taskId: this.session.pendingTaskId || this.session.taskId,
      list: this.session.pendingList || this.session.list
    };
    this.session = skipBreak(this.session);
    this.persist();
    this._emit();
  }

  /**
   * @param {'required'|'optional'} list
   * @param {string} taskId
   */
  _switchDuringWork(list, taskId) {
    const dateKey = todayKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, list, taskId);
    if (!task || task.completed) return;
    const { session } = switchTask(this.session, {
      taskId,
      list,
      dateKey,
      now: this.now()
    });
    this.session = session;
    this.selected = { taskId, list };
    this.persist();
    this._emit();
  }

  _emit() {
    this.eventBus.emit(Events.POMODORO_UPDATED, this.getSnapshot());
  }
}
