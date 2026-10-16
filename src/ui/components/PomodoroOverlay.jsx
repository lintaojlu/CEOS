import React, { useEffect, useRef, useState } from 'react';
import { MAX_FOCUS_MINUTES } from '../../domain/pomodoro/session.js';
import { useApp, useShell } from '../app/context.jsx';

const RING_SIZE = 280;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function minutesFromPointer(event, element) {
  const rect = element.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const degrees = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
  const minutes = Math.round((degrees / 360) * MAX_FOCUS_MINUTES);
  return minutes <= 0 ? MAX_FOCUS_MINUTES : minutes;
}

export function PomodoroOverlay() {
  const app = useApp();
  useShell();
  const node = useRef(null);
  const clockRef = useRef(null);
  const dragging = useRef(false);
  const [dragMinutes, setDragMinutes] = useState(null);
  const snap = app.pomodoroService.getSnapshot();
  const open = snap.phase === 'setup' || snap.phase === 'work';
  const setup = snap.phase === 'setup';

  useEffect(() => {
    if (!open) return;
    node.current?.focus();
  }, [open]);

  if (!open) return null;

  const minutes = dragMinutes ?? Math.max(1, Math.round(snap.durationMs / 60000));
  const ratio = setup
    ? minutes / MAX_FOCUS_MINUTES
    : (snap.durationMs > 0 ? Math.min(1, Math.max(0, snap.remainingMs / snap.durationMs)) : 0);
  const angle = (minutes / MAX_FOCUS_MINUTES) * Math.PI * 2 - Math.PI / 2;
  const handleX = RING_SIZE / 2 + Math.cos(angle) * RING_RADIUS;
  const handleY = RING_SIZE / 2 + Math.sin(angle) * RING_RADIUS;
  const title = snap.activeTask?.text?.trim() || '';

  function onPointerDown(event) {
    if (!setup || !clockRef.current) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    dragging.current = true;
    try {
      clockRef.current.setPointerCapture(event.pointerId);
    } catch {
      // 没有真实指针时忽略，拖动仍按按下和松开计算。
    }
    setDragMinutes(minutesFromPointer(event, clockRef.current));
  }

  function onPointerMove(event) {
    if (!dragging.current || !clockRef.current) return;
    setDragMinutes(minutesFromPointer(event, clockRef.current));
  }

  function onPointerUp(event) {
    if (!dragging.current || !clockRef.current) return;
    dragging.current = false;
    const next = minutesFromPointer(event, clockRef.current);
    setDragMinutes(null);
    app.pomodoroService.setDuration(next);
  }

  return (
    <div
      ref={node}
      className="pomo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="专注"
      tabIndex={-1}
      onSelectStart={(event) => event.preventDefault()}
    >
      <div
        ref={clockRef}
        className={setup ? 'pomo-clock is-setup' : 'pomo-clock'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
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
        {setup ? (
          <svg className="pomo-handle-layer" width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
            <circle className="pomo-handle" cx={handleX} cy={handleY} r="8" />
          </svg>
        ) : null}
        <div className="pomo-clock-face">
          <div className="pomo-phase">{setup ? '选择时长' : '专注中'}</div>
          <div className="pomo-timer">{setup ? `${minutes}:00` : snap.remainingLabel}</div>
        </div>
      </div>
      {title ? <p className="pomo-overlay-title">{title}</p> : null}
      <div className="pomo-actions">
        {setup ? (
          <button type="button" className="btn btn-primary" onClick={() => app.pomodoroService.begin()}>开始</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => app.pomodoroService.complete()}>完成</button>
        )}
        <button type="button" className="btn btn-quiet btn-danger" onClick={() => app.pomodoroService.abandon()}>放弃</button>
      </div>
    </div>
  );
}
