import { describe, expect, it } from 'vitest';
import { createImeEnterGuard, holdImeEnter } from './ime-enter.js';

function enter({ isComposing = false, keyCode = 13 } = {}) {
  return {
    key: 'Enter',
    isComposing,
    keyCode,
    nativeEvent: { isComposing, keyCode },
    prevented: false,
    preventDefault() { this.prevented = true; },
  };
}

function guardWithQueue() {
  const queued = [];
  const guard = createImeEnterGuard((fn) => { queued.push(fn); });
  return {
    guard,
    flush() { queued.splice(0).forEach((fn) => fn()); },
  };
}

describe('ime enter', () => {
  it('lets the candidate-confirming enter commit without submitting', () => {
    const { guard } = guardWithQueue();
    guard.onCompositionStart();
    const event = enter({ isComposing: true, keyCode: 229 });
    expect(holdImeEnter(event, guard)).toBe(true);
    expect(event.prevented).toBe(false);
    expect(guard.shouldIgnoreSubmit()).toBe(true);
  });

  it('ignores the enter WebKit fires after composition ends, then accepts the next one', () => {
    const { guard, flush } = guardWithQueue();
    guard.onCompositionStart();
    guard.onCompositionEnd();
    const ghost = enter();
    expect(holdImeEnter(ghost, guard)).toBe(true);
    expect(ghost.prevented).toBe(true);
    expect(guard.shouldIgnoreSubmit()).toBe(true);

    flush();
    const next = enter();
    expect(holdImeEnter(next, guard)).toBe(false);
    expect(next.prevented).toBe(false);
    expect(guard.shouldIgnoreSubmit()).toBe(false);
  });

  it('accepts enter after a composition that produced no extra keydown', () => {
    const { guard, flush } = guardWithQueue();
    guard.onCompositionStart();
    expect(holdImeEnter(enter({ isComposing: true, keyCode: 229 }), guard)).toBe(true);
    guard.onCompositionEnd();
    flush();
    expect(holdImeEnter(enter(), guard)).toBe(false);
  });

  it('drops a stale release when composition starts again', () => {
    const { guard, flush } = guardWithQueue();
    guard.onCompositionEnd();
    guard.onCompositionStart();
    flush();
    expect(guard.shouldIgnoreSubmit()).toBe(true);
    expect(holdImeEnter(enter({ isComposing: true }), guard)).toBe(true);
  });
});
