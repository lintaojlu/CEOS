import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOCUS_MINUTES,
  abandon,
  beginWork,
  finishWork,
  focusMs,
  normalizeSession,
  openSetup,
  remainingMs,
  withDuration
} from './session.js';

const base = {
  taskId: 't1',
  list: /** @type {const} */ ('required'),
  dateKey: '2026-10-15'
};

describe('pomodoro session', () => {
  it('opens on the dial at 25 minutes and does not start the clock', () => {
    const session = openSetup(base);
    expect(session.phase).toBe('setup');
    expect(session.durationMs).toBe(focusMs(DEFAULT_FOCUS_MINUTES));
    expect(session.endsAt).toBe(0);
    expect(beginWork(null, 1)).toBeNull();
  });

  it('dragging the dial only changes the setup duration', () => {
    const session = openSetup(base);
    const next = withDuration(session, 40);
    expect(next?.durationMs).toBe(focusMs(40));
    expect(next?.phase).toBe('setup');
    expect(withDuration(next, 0)?.durationMs).toBe(focusMs(1));
    expect(withDuration(next, 90)?.durationMs).toBe(focusMs(60));
  });

  it('begin starts a countdown for the chosen duration', () => {
    const now = 1_000_000;
    const session = withDuration(openSetup(base), 10);
    const work = beginWork(session, now);
    expect(work?.phase).toBe('work');
    expect(work?.endsAt).toBe(now + focusMs(10));
    expect(remainingMs(work, now + 1000)).toBe(focusMs(10) - 1000);
    expect(withDuration(work, 5)).toBe(work);
  });

  it('running out of time leaves the round open', () => {
    const now = 1_000_000;
    const work = beginWork(openSetup(base), now);
    expect(remainingMs(work, now + work.durationMs + 5000)).toBe(0);
    expect(work.phase).toBe('work');
  });

  it('finish checks the task and ends; abandon ends without checking', () => {
    const work = beginWork(openSetup(base), 1_000_000);
    const done = finishWork(work);
    expect(done.markComplete).toBe(true);
    expect(done.session).toBeNull();
    expect(done.taskId).toBe('t1');
    expect(abandon(work)).toBeNull();
    expect(finishWork(openSetup(base)).markComplete).toBe(false);
  });

  it('drops a stored break and keeps a stored work round', () => {
    expect(normalizeSession({ ...base, phase: 'break', endsAt: 50, durationMs: focusMs(5) })).toBeNull();
    const work = normalizeSession({ ...base, phase: 'work', endsAt: 50_000, durationMs: focusMs(15) });
    expect(work?.phase).toBe('work');
    expect(work?.durationMs).toBe(focusMs(15));
    expect(work?.endsAt).toBe(50_000);
  });
});
