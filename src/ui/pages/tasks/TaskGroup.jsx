import React, { useRef, useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { Checkbox, ContextMenu } from '../../library/index.js';
import { TaskRow } from './TaskRow.jsx';
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
  const [menu, setMenu] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(task.text || '');
  const edge = dropEdge === 'before' ? ' is-drop-before' : dropEdge === 'after' ? ' is-drop-after' : '';
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

  function commitRename() {
    const text = draft.trim();
    setRenaming(false);
    if (!text) {
      setDraft(task.text || '');
      return;
    }
    app.scheduleService.renameGroup(type, task.id, text);
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
          onDoubleClick={(event) => {
            if (drag.current) return;
            if (event.target.closest('button, input, textarea, a, label, select')) return;
            setDraft(task.text || '');
            setRenaming(true);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY });
          }}
        >
          <Checkbox checked={task.completed} onChange={() => app.scheduleService.toggleTask(type, task.id)} />
          <div className="task-main">
            <div className="task-line">
              {renaming ? (
                <input
                  className="field group-rename"
                  value={draft}
                  autoFocus
                  aria-label="分组标题"
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                      setDraft(task.text || '');
                      setRenaming(false);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                />
              ) : (
                <TaskText text={task.text || ''} done={task.completed} />
              )}
            </div>
          </div>
        </div>
      )}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[{ id: 'dissolve', label: '解散', onSelect: () => app.scheduleService.deleteTask(type, task.id) }]}
        />
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
