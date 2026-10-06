import React, { useState } from 'react';
import { normalizeSubtasks } from '../../../domain/schedule/daily-task.js';
import { useApp } from '../../app/context.jsx';
import { Checkbox } from '../../components/Checkbox.jsx';
import { TaskText } from './TaskText.jsx';

export function TaskRow({ task, type, onEdit, dropEdge, onReorderStart }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const subtasks = normalizeSubtasks(task.subtasks);
  const done = subtasks.filter((item) => item.completed).length;
  const recurrence = task.recurrence === 'daily' ? '每日' : task.recurrence === 'weekdays' ? '工作日' : '';
  const edge = dropEdge === 'before' ? ' is-drop-before' : dropEdge === 'after' ? ' is-drop-after' : '';

  return (
    <div className={`task-block${edge}`}>
      <div
        className="task-row is-reorderable"
        data-task-id={task.id}
        data-task-type={type}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (event.target.closest('button, input, a, label')) return;
          onReorderStart?.(event, type, task.id);
        }}
      >
        <button type="button" className={open ? 'chevron is-open' : 'chevron'} aria-label="展开子任务" onClick={() => setOpen((value) => !value)}>›</button>
        <Checkbox checked={task.completed} onChange={() => app.scheduleService.toggleTask(type, task.id)} />
        <div className="task-main" title="双击编辑" onDoubleClick={() => onEdit(type, task.id)}>
          <div className="task-line">
            <TaskText text={app.scheduleService.taskTitle(task)} done={task.completed} />
            {recurrence ? <span className="chip">{recurrence}</span> : null}
            {subtasks.length ? <span className="chip">{done}/{subtasks.length}</span> : null}
          </div>
          {task.note ? <div className="card-note">{task.note}</div> : null}
        </div>
      </div>
      {open ? (
        <div className="subtasks">
          <div className="sub-row">
            <input
              className="field"
              placeholder="添加子任务，回车确认"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                const text = event.currentTarget.value.trim();
                if (!text) return;
                app.scheduleService.addSubtask(type, task.id, text);
                event.currentTarget.value = '';
              }}
            />
          </div>
          {subtasks.map((sub) => (
            <div key={sub.id} className="sub-row">
              <Checkbox checked={sub.completed} onChange={() => app.scheduleService.toggleSubtask(type, task.id, sub.id)} />
              <span className={sub.completed ? 'is-done' : ''}>{sub.text}</span>
              <button type="button" className="btn btn-quiet btn-danger btn-mono" onClick={() => app.scheduleService.deleteSubtask(type, task.id, sub.id)}>删除</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
