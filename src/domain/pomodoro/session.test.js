import { describe, it, expect } from 'vitest';
import {
  WORK_MS,
  BREAK_MS,
  startWork,
  settle,
  abandon,
  skipBreak,
  switchTask,
  focusFromTaskRow,
  remainingMs
} from './session.js';

const base = {
  taskId: 't1',
  list: /** @type {const} */ ('required'),
  dateKey: '2026-10-06'
};

describe('pomodoro session', () => {
  it('completing work enters break and awards +1 once', () => {
    const now = 1_000_000;
    const session = startWork({ ...base, now });
    expect(session.phase).toBe('work');
    expect(session.endsAt).toBe(now + WORK_MS);

    const mid = settle(session, now + WORK_MS - 1);
    expect(mid.awardPomodoro).toBe(false);
    expect(mid.session?.phase).toBe('work');

    const done = settle(session, now + WORK_MS);
    expect(done.awardPomodoro).toBe(true);
    expect(done.award).toEqual({
      taskId: 't1',
      list: 'required',
      dateKey: '2026-10-06'
    });
    expect(done.session?.phase).toBe('break');
    expect(done.session?.endsAt).toBe(now + WORK_MS + BREAK_MS);
    expect(done.session?.taskId).toBe('t1');
  });

  it('abandon during work awards nothing', () => {
    const now = 1_000_000;
    const session = startWork({ ...base, now });
    expect(abandon(session)).toBeNull();
    expect(settle(session, now + 1000).awardPomodoro).toBe(false);
  });

  it('after break ends, stays on the same task idle (no auto next round)', () => {
    const now = 1_000_000;
    const work = startWork({ ...base, now });
    const afterWork = settle(work, now + WORK_MS);
    expect(afterWork.session?.phase).toBe('break');

    const afterBreak = settle(afterWork.session, now + WORK_MS + BREAK_MS);
    expect(afterBreak.awardPomodoro).toBe(false);
    expect(afterBreak.session).toBeNull();
    expect(afterBreak.idleTaskId).toBe('t1');
    expect(afterBreak.idleList).toBe('required');
  });

  it('sleep past work+break awards only once and returns idle', () => {
    const now = 1_000_000;
    const session = startWork({ ...base, now });
    const far = settle(session, now + WORK_MS + BREAK_MS + 60_000);
    expect(far.awardPomodoro).toBe(true);
    expect(far.award?.taskId).toBe('t1');
    expect(far.session).toBeNull();
    expect(far.idleTaskId).toBe('t1');
    expect(settle(null, now + WORK_MS + BREAK_MS + 120_000).awardPomodoro).toBe(false);
  });

  it('skipBreak clears break without a second award', () => {
    const now = 1_000_000;
    const work = startWork({ ...base, now });
    const br = settle(work, now + WORK_MS).session;
    expect(skipBreak(br)).toBeNull();
  });

  it('switch during work voids the round and starts the new task', () => {
    const now = 1_000_000;
    const work = startWork({ ...base, now });
    const { session, started } = switchTask(work, {
      taskId: 't2',
      list: 'optional',
      dateKey: '2026-10-06',
      now: now + 5_000
    });
    expect(started).toBe(true);
    expect(session?.taskId).toBe('t2');
    expect(session?.phase).toBe('work');
    expect(session?.endsAt).toBe(now + 5_000 + WORK_MS);
    expect(settle(session, now + 5_000 + 1).awardPomodoro).toBe(false);
  });

  it('switch during break only docks the next task', () => {
    const now = 1_000_000;
    const work = startWork({ ...base, now });
    const br = settle(work, now + WORK_MS).session;
    const { session, started } = switchTask(br, {
      taskId: 't2',
      list: 'optional',
      dateKey: '2026-10-06',
      now: now + WORK_MS + 1_000
    });
    expect(started).toBe(false);
    expect(session?.phase).toBe('break');
    expect(session?.taskId).toBe('t1');
    expect(session?.pendingTaskId).toBe('t2');
    expect(remainingMs(session, now + WORK_MS + 1_000)).toBeGreaterThan(0);

    const after = settle(session, now + WORK_MS + BREAK_MS);
    expect(after.session).toBeNull();
    expect(after.idleTaskId).toBe('t2');
    expect(after.idleList).toBe('optional');
  });

  it('focusFromTaskRow during break ends break and starts work', () => {
    const now = 1_000_000;
    const work = startWork({ ...base, now });
    const br = settle(work, now + WORK_MS).session;
    const next = focusFromTaskRow(br, {
      taskId: 't2',
      list: 'optional',
      dateKey: '2026-10-06',
      now: now + WORK_MS + 2_000
    });
    expect(next.phase).toBe('work');
    expect(next.taskId).toBe('t2');
    expect(next.endsAt).toBe(now + WORK_MS + 2_000 + WORK_MS);
  });
});
