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
 * Orchestrates a single pomodoro round bound to a real today-task.
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
    /** Selected task while idle (right-list click). */
    /** @type {{ taskId: string, list: 'required'|'optional' }|null} */
    this.selected = null;
    /** @type {ReturnType<typeof setInterval>|null} */
    this._timer = null;
    this._unsubTasks = null;
  }

  load() {
    this.session = this.pomodoroRepo.load();
    this.tick();
    this._unsubTasks = this.eventBus.on(Events.TASKS_UPDATED, () => this.onTasksUpdated());
    this.startTicker();
  }

  persist() {
    this.pomodoroRepo.save(this.session);
  }

  startTicker() {
    if (this._timer != null) return;
    const align = () => {
      this.tick();
      const delay = 1000 - (this.now() % 1000);
      this._timer = setTimeout(() => {
        this._timer = setInterval(() => this.tick(), 1000);
        this.tick();
      }, delay);
    };
    align();
  }

  stopTicker() {
    if (this._timer != null) {
      clearTimeout(this._timer);
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Settle elapsed time; award at most once per work completion. */
  tick() {
    const before = this.session;
    // Task deleted → void the round (no award).
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
    }

    const result = settle(this.session, this.now());
    if (result.awardPomodoro && result.award) {
      const ok = this.scheduleService.incrementPomodoro(
        result.award.dateKey,
        result.award.list,
        result.award.taskId
      );
      if (!ok) {
        // Deleted between settle check and award — drop session, no count.
        this.session = null;
        this.persist();
        this._emit();
        return;
      }
    }
    this.session = result.session;
    if (result.idleTaskId) {
      this.selected = { taskId: result.idleTaskId, list: result.idleList || 'required' };
    }
    if (before !== this.session || result.awardPomodoro) {
      this.persist();
    }
    this._emit();
  }

  onTasksUpdated() {
    if (!this.session) {
      this._emit();
      return;
    }
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
   * Incomplete required/optional on real today (not the viewed day).
   * @returns {Array<{ list: 'required'|'optional', task: any }>}
   */
  listTodayIncomplete() {
    return this.scheduleService.listIncompleteOnDate(todayKey());
  }

  /**
   * @returns {{
   *   session: import('../domain/pomodoro/session.js').PomodoroSession|null,
   *   remainingMs: number,
   *   remainingLabel: string,
   *   selected: { taskId: string, list: 'required'|'optional' }|null,
   *   activeTask: any|null,
   *   phase: 'idle'|'work'|'break'
   * }}
   */
  getSnapshot() {
    const now = this.now();
    const rem = remainingMs(this.session, now);
    const phase = this.session ? this.session.phase : 'idle';
    let activeTask = null;
    if (this.session) {
      activeTask = this.scheduleService.findTaskOnDate(
        this.session.dateKey,
        this.session.list,
        this.session.taskId
      );
    } else if (this.selected) {
      activeTask = this.scheduleService.findTaskOnDate(
        todayKey(),
        this.selected.list,
        this.selected.taskId
      );
    }
    return {
      session: this.session,
      remainingMs: rem,
      remainingLabel: formatRemaining(rem),
      selected: this.selected,
      activeTask,
      phase
    };
  }

  /**
   * Idle right-list click: select only.
   * @param {'required'|'optional'} list
   * @param {string} taskId
   */
  selectTask(list, taskId) {
    this.tick();
    if (this.session?.phase === 'work') {
      this._switchDuringWork(list, taskId);
      return;
    }
    if (this.session?.phase === 'break') {
      const { session } = switchTask(this.session, {
        taskId,
        list,
        dateKey: todayKey(),
        now: this.now()
      });
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
   * Start work on selected / given task (idle).
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
    if (this.session?.phase === 'break') {
      // Start button during break is not primary; treat as focus (end break).
      this.session = focusFromTaskRow(this.session, {
        taskId: targetId,
        list: targetList,
        dateKey,
        now: this.now()
      });
    } else {
      this.session = startWork({
        taskId: targetId,
        list: targetList,
        dateKey,
        now: this.now()
      });
    }
    this.selected = { taskId: targetId, list: targetList };
    this.persist();
    this._emit();
  }

  /**
   * Task-row「专注」: void other work / end break, start immediately.
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
    } else if (this.session.phase === 'break') {
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
