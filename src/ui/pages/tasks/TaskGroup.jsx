import React, { useEffect, useRef, useState } from 'react';
import { normalizeNotes } from '../../../domain/schedule/daily-task.js';
import { useApp } from '../../app/context.jsx';
import { Checkbox } from '../../library/index.js';
import { TaskNoteCards, TaskRow } from './TaskRow.jsx';
import { TaskText } from './TaskText.jsx';

export function TaskGroup({
  task,
  type,
  onEdit,
  dropEdge,
  dragging = false,
  held = false,
  onReorderStart,
  extraChild = null,
  untitled = false,
  childEdge
}) {
  const app = useApp();
  const drag = useRef(false);
  const openTimer = useRef(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const edge = dropEdge === 'before' ? ' is-drop-before' : dropEdge === 'after' ? ' is-drop-after' : '';
  const notes = untitled ? [] : normalizeNotes(task.notes, { note: task.note, subtasks: task.subtasks });
  const children = untitled
    ? [task, extraChild].filter(Boolean)
    : [...(task.children || []), ...(extraChild ? [extraChild] : [])];

  function startDrag(event) {
    if (event.button !== 0) return;
    if (event.target.closest('button, input, textarea, a, label, select')) return;
    const startX = event.clientX;
    const startY = event.clientY;
    drag.current = false;
    const move = (moveEvent) => {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >= 6) drag.current = true;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    onReorderStart?.(event, type, task.id);
  }

  useEffect(() => () => window.clearTimeout(openTimer.current), []);

  function revealNotes(event) {
    if (drag.current || !notes.length) return;
    if (event.target.closest('button, input, textarea, a, label, select')) return;
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setNotesOpen((open) => !open), 250);
  }

  return (
    <div
      className={`task-group task-block${edge}${dragging ? ' is-dragging' : ''}${held ? ' is-held' : ''}${untitled ? ' is-preview' : ''}`}
      data-drop-row=""
      data-task-id={task.id}
      {...(untitled ? {} : { 'data-task-group': '' })}
    >
      {untitled ? null : (
        <div
          className="task-row is-reorderable task-group-title"
          onPointerDown={startDrag}
          onClick={revealNotes}
          onDoubleClick={(event) => {
            window.clearTimeout(openTimer.current);
            if (drag.current) return;
            if (event.target.closest('button, input, textarea, a, label, select')) return;
            onEdit(type, task.id);
          }}
        >
          <Checkbox checked={task.completed} onChange={() => app.scheduleService.toggleTask(type, task.id)} />
          <div className="task-main" title="双击编辑">
            <div className="task-line">
              <TaskText text={task.text || ''} done={task.completed} />
            </div>
          </div>
        </div>
      )}
      {notesOpen && notes.length ? (
        <div className="note-stack">
          <TaskNoteCards notes={notes} />
        </div>
      ) : null}
      <div className="task-group-children">
        {children.map((child) => (
          <TaskRow
            key={child.id}
            task={child}
            type={type}
            onEdit={onEdit}
            bare={untitled}
            dragging={dragging && child.id === task.id}
            dropEdge={childEdge?.(child.id) || ''}
            onReorderStart={untitled ? undefined : onReorderStart}
          />
        ))}
      </div>
    </div>
  );
}
