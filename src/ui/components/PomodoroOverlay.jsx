import React, { useEffect, useRef } from 'react';
import { BREAK_MS, WORK_MS } from '../../domain/pomodoro/session.js';
import { useApp, useShell } from '../app/context.jsx';

const RING_SIZE = 280;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function PomodoroOverlay() {
  const app = useApp();
  useShell();
  const node = useRef(null);
  const snap = app.pomodoroService.getSnapshot();
  const running = snap.phase === 'work' || snap.phase === 'break';

  useEffect(() => {
    if (!running) return;
    node.current?.focus();
  }, [running]);

  if (!running) return null;

  const phaseLabel = snap.phase === 'break' ? '休息中' : '专注中';
  const totalMs = snap.phase === 'break' ? BREAK_MS : WORK_MS;
  const ratio = Math.min(1, Math.max(0, snap.remainingMs / totalMs));
  const title = snap.activeTask?.text?.trim() || '';

  return (
    <div
      ref={node}
      className="pomo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="番茄钟"
      tabIndex={-1}
    >
      <div className="pomo-clock">
        <svg className="pomo-ring" width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
          <circle className="pomo-ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} />
          <circle
            className="pomo-ring-value"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - ratio)}
          />
        </svg>
        <div className="pomo-clock-face">
          <div className="pomo-phase">{phaseLabel}</div>
          <div className="pomo-timer">{snap.remainingLabel}</div>
        </div>
      </div>
      {title ? <p className="pomo-overlay-title">{title}</p> : null}
      <div className="pomo-actions">
        {snap.phase === 'work' ? (
          <button type="button" className="btn btn-primary" onClick={() => app.pomodoroService.complete()}>完成</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => app.pomodoroService.skipBreak()}>跳过休息</button>
        )}
        <button type="button" className="btn btn-quiet btn-danger" onClick={() => app.pomodoroService.abandon()}>放弃</button>
      </div>
    </div>
  );
}
