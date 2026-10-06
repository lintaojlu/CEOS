/**
 * Pure pomodoro session transitions.
 * One work round binds a real unfinished today-task; work completion awards +1
 * on the start-day copy, then a 5-minute break. Absolute endsAt keeps time
 * across page leaves / sleep — settle once, never chain awards.
 */

export const WORK_MS = 25 * 60 * 1000;
export const BREAK_MS = 5 * 60 * 1000;

/**
 * @typedef {'work'|'break'} PomodoroPhase
 *
 * @typedef {Object} PomodoroSession
 * @property {string} taskId
 * @property {'required'|'optional'} list
 * @property {string} dateKey
 * @property {PomodoroPhase} phase
 * @property {number} endsAt
 * @property {string} [pendingTaskId]
 * @property {'required'|'optional'} [pendingList]
 */

/**
 * @param {any} raw
 * @returns {PomodoroSession|null}
 */
export function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const taskId = typeof raw.taskId === 'string' ? raw.taskId : '';
  const list = raw.list === 'optional' ? 'optional' : raw.list === 'required' ? 'required' : '';
  const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey : '';
  const phase = raw.phase === 'break' ? 'break' : raw.phase === 'work' ? 'work' : '';
  const endsAt = typeof raw.endsAt === 'number' && Number.isFinite(raw.endsAt) ? raw.endsAt : NaN;
  if (!taskId || !list || !dateKey || !phase || Number.isNaN(endsAt)) return null;

  /** @type {PomodoroSession} */
  const session = { taskId, list, dateKey, phase, endsAt };
  if (typeof raw.pendingTaskId === 'string' && raw.pendingTaskId) {
    session.pendingTaskId = raw.pendingTaskId;
    session.pendingList = raw.pendingList === 'optional' ? 'optional' : 'required';
  }
  return session;
}

/**
 * @param {PomodoroSession|null|undefined} session
 * @param {number} now
 * @returns {number}
 */
export function remainingMs(session, now) {
  if (!session) return 0;
  return Math.max(0, session.endsAt - now);
}

/**
 * @param {number} ms
 * @returns {string} m:ss
 */
export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * @param {object} args
 * @param {string} args.taskId
 * @param {'required'|'optional'} args.list
 * @param {string} args.dateKey
 * @param {number} args.now
 * @returns {PomodoroSession}
 */
export function startWork({ taskId, list, dateKey, now }) {
  return {
    taskId,
    list,
    dateKey,
    phase: 'work',
    endsAt: now + WORK_MS
  };
}

/**
 * @typedef {Object} SettleResult
 * @property {PomodoroSession|null} session
 * @property {boolean} awardPomodoro
 * @property {{ taskId: string, list: 'required'|'optional', dateKey: string }|null} award
 * @property {string} [idleTaskId]
 * @property {'required'|'optional'} [idleList]
 */

/**
 * Advance the session to `now`. Sleep / background only settles once:
 * work → break (award once) → idle. Never awards twice.
 *
 * @param {PomodoroSession|null} session
 * @param {number} now
 * @returns {SettleResult}
 */
export function settle(session, now) {
  if (!session) {
    return { session: null, awardPomodoro: false, award: null };
  }
  if (now < session.endsAt) {
    return { session, awardPomodoro: false, award: null };
  }

  if (session.phase === 'work') {
    const award = {
      taskId: session.taskId,
      list: session.list,
      dateKey: session.dateKey
    };
    const breakEndsAt = session.endsAt + BREAK_MS;
    if (now < breakEndsAt) {
      return {
        session: {
          taskId: session.taskId,
          list: session.list,
          dateKey: session.dateKey,
          phase: 'break',
          endsAt: breakEndsAt
        },
        awardPomodoro: true,
        award
      };
    }
    return {
      session: null,
      awardPomodoro: true,
      award,
      idleTaskId: session.pendingTaskId || session.taskId,
      idleList: session.pendingList || session.list
    };
  }

  return {
    session: null,
    awardPomodoro: false,
    award: null,
    idleTaskId: session.pendingTaskId || session.taskId,
    idleList: session.pendingList || session.list
  };
}

/** @param {PomodoroSession|null} _session */
export function abandon(_session) {
  return null;
}

/** @param {PomodoroSession|null} session */
export function skipBreak(session) {
  if (!session || session.phase !== 'break') return session;
  return null;
}

/**
 * @param {PomodoroSession|null} session
 * @param {object} next
 * @param {string} next.taskId
 * @param {'required'|'optional'} next.list
 * @param {string} next.dateKey
 * @param {number} next.now
 * @returns {{ session: PomodoroSession|null, started: boolean }}
 */
export function switchTask(session, { taskId, list, dateKey, now }) {
  if (!session || session.phase === 'work') {
    return { session: startWork({ taskId, list, dateKey, now }), started: true };
  }
  return {
    session: {
      ...session,
      pendingTaskId: taskId,
      pendingList: list
    },
    started: false
  };
}

/**
 * Task-row「专注」: void other work / end remaining break and start immediately.
 * @param {PomodoroSession|null} _session
 * @param {object} next
 * @param {string} next.taskId
 * @param {'required'|'optional'} next.list
 * @param {string} next.dateKey
 * @param {number} next.now
 * @returns {PomodoroSession}
 */
export function focusFromTaskRow(_session, { taskId, list, dateKey, now }) {
  return startWork({ taskId, list, dateKey, now });
}
