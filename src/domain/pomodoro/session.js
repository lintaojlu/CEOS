/**
 * 专注一轮：先在圆盘上选时长，点开始才倒计时。
 * 完成勾上当天那条任务，放弃不勾。时间走完不会自己结束，完成和放弃才结束。
 */

export const MIN_FOCUS_MINUTES = 1;
export const MAX_FOCUS_MINUTES = 60;
export const DEFAULT_FOCUS_MINUTES = 25;

/**
 * @typedef {'setup'|'work'} PomodoroPhase
 *
 * @typedef {Object} PomodoroSession
 * @property {string} taskId
 * @property {'required'|'optional'} list
 * @property {string} dateKey
 * @property {PomodoroPhase} phase
 * @property {number} durationMs
 * @property {number} endsAt
 */

/**
 * @param {number} minutes
 * @returns {number}
 */
export function clampFocusMinutes(minutes) {
  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n)) return DEFAULT_FOCUS_MINUTES;
  return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, n));
}

/** @param {number} minutes */
export function focusMs(minutes) {
  return clampFocusMinutes(minutes) * 60 * 1000;
}

/**
 * @param {any} raw
 * @returns {PomodoroSession|null}
 */
export function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const taskId = typeof raw.taskId === 'string' ? raw.taskId : '';
  const list = raw.list === 'optional' ? 'optional' : raw.list === 'required' ? 'required' : '';
  const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey : '';
  const phase = raw.phase === 'setup' ? 'setup' : raw.phase === 'work' ? 'work' : '';
  if (!taskId || !list || !dateKey || !phase) return null;
  const durationMs = focusMs(
    typeof raw.durationMs === 'number' && raw.durationMs > 0
      ? raw.durationMs / 60000
      : DEFAULT_FOCUS_MINUTES
  );
  const endsAt = typeof raw.endsAt === 'number' && Number.isFinite(raw.endsAt) ? raw.endsAt : 0;
  if (phase === 'work' && endsAt <= 0) return null;
  return {
    taskId,
    list,
    dateKey,
    phase,
    durationMs,
    endsAt: phase === 'setup' ? 0 : endsAt
  };
}

/**
 * @param {object} args
 * @param {string} args.taskId
 * @param {'required'|'optional'} args.list
 * @param {string} args.dateKey
 * @param {number} [args.minutes]
 * @returns {PomodoroSession}
 */
export function openSetup({ taskId, list, dateKey, minutes = DEFAULT_FOCUS_MINUTES }) {
  return {
    taskId,
    list,
    dateKey,
    phase: 'setup',
    durationMs: focusMs(minutes),
    endsAt: 0
  };
}

/**
 * @param {PomodoroSession|null} session
 * @param {number} minutes
 * @returns {PomodoroSession|null}
 */
export function withDuration(session, minutes) {
  if (!session || session.phase !== 'setup') return session;
  return { ...session, durationMs: focusMs(minutes) };
}

/**
 * @param {PomodoroSession|null} session
 * @param {number} now
 * @returns {PomodoroSession|null}
 */
export function beginWork(session, now) {
  if (!session || session.phase !== 'setup') return session;
  return { ...session, phase: 'work', endsAt: now + session.durationMs };
}

/**
 * @param {PomodoroSession|null|undefined} session
 * @param {number} now
 * @returns {number}
 */
export function remainingMs(session, now) {
  if (!session) return 0;
  if (session.phase !== 'work') return session.durationMs;
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
 * @param {PomodoroSession|null} session
 * @returns {{ session: null, markComplete: boolean, taskId?: string, list?: 'required'|'optional', dateKey?: string }}
 */
export function finishWork(session) {
  if (!session || session.phase !== 'work') {
    return { session: session || null, markComplete: false };
  }
  return {
    session: null,
    markComplete: true,
    taskId: session.taskId,
    list: session.list,
    dateKey: session.dateKey
  };
}

/** @param {PomodoroSession|null} _session */
export function abandon(_session) {
  return null;
}
