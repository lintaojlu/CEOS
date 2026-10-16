import { todayKey } from '../domain/shared/date-key.js';
import {
  abandon,
  beginWork,
  finishWork,
  formatRemaining,
  openSetup,
  remainingMs,
  withDuration
} from '../domain/pomodoro/session.js';
import { Events } from './event-bus.js';

/**
 * 当天一条未完成任务上的一轮专注。时长先选好，开始后才记结束时间。
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
    /** @type {ReturnType<typeof setTimeout>|ReturnType<typeof setInterval>|null} */
    this._timer = null;
  }

  load() {
    this.session = this.pomodoroRepo.load();
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
      return;
    }
    if (this.session.phase === 'work') this._emit();
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

  /**
   * 任务行上的「专注」。只打开选时长，不开始倒计时。
   * @param {'required'|'optional'} list
   * @param {string} taskId
   */
  focusTask(list, taskId) {
    const dateKey = todayKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, list, taskId);
    if (!task || task.completed) return;
    this.session = openSetup({ taskId, list, dateKey });
    this.persist();
    this._emit();
  }

  /** @param {number} minutes */
  setDuration(minutes) {
    if (!this.session || this.session.phase !== 'setup') return;
    this.session = withDuration(this.session, minutes);
    this.persist();
    this._emit();
  }

  begin() {
    if (!this.session || this.session.phase !== 'setup') return;
    const found = this.scheduleService.findTaskOnDate(
      this.session.dateKey,
      this.session.list,
      this.session.taskId
    );
    if (!found || found.completed) {
      this.abandon();
      return;
    }
    this.session = beginWork(this.session, this.now());
    this.persist();
    this._emit();
  }

  complete() {
    const result = finishWork(this.session);
    if (!result.markComplete || !result.dateKey || !result.list || !result.taskId) return;
    const found = this.scheduleService.findTaskOnDate(result.dateKey, result.list, result.taskId);
    this.session = null;
    this.persist();
    if (found && !found.completed) {
      this.scheduleService.completeTaskOnDate(result.dateKey, result.list, result.taskId);
    }
    this._emit();
  }

  abandon() {
    if (!this.session) return;
    this.session = abandon(this.session);
    this.persist();
    this._emit();
  }

  getSnapshot() {
    const now = this.now();
    const session = this.session;
    const phase = session ? session.phase : 'idle';
    const durationMs = session?.durationMs || 0;
    const rem = remainingMs(session, now);
    let activeTask = null;
    if (session) {
      activeTask = this.scheduleService.findTaskOnDate(session.dateKey, session.list, session.taskId);
    }
    return {
      session,
      phase,
      durationMs,
      remainingMs: rem,
      remainingLabel: formatRemaining(rem),
      activeTask
    };
  }

  _emit() {
    this.eventBus.emit(Events.POMODORO_UPDATED, this.getSnapshot());
  }
}
