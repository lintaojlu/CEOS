import React from 'react';
import { getDateKey } from '../../../domain/shared/date-key.js';
import { useApp } from '../../app/context.jsx';
import { Checkbox } from '../../components/Checkbox.jsx';

export function DayDetailPanel({ dateKey, onOpenTasks }) {
  const app = useApp();
  const day = app.scheduleService.data[dateKey];
  const summary = app.statsService.daySummary(dateKey);
  const groups = [
    ['required', '必做', day?.required || []],
    ['optional', '选做', day?.optional || []]
  ];

  return (
    <aside className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">{dateKey}</h2>
          <p className="card-note">{summary.total ? `完成 ${summary.completed}/${summary.total}` : '这一天没有任务'}</p>
        </div>
        <button type="button" className="btn btn-mono" onClick={() => onOpenTasks(dateKey)}>在任务页打开</button>
      </div>
      {summary.milestones.length ? (
        <div className="task-line" style={{ marginBottom: 10 }}>
          {summary.milestones.map((item) => <span key={item.id} className="chip chip-accent">{item.title}</span>)}
        </div>
      ) : null}
      {groups.map(([type, label, tasks]) => (
        <div key={type}>
          <div className="group-label">{label}</div>
          {tasks.length === 0 ? <p className="empty">无</p> : tasks.map((task) => (
            <label key={task.id} className="detail-task">
              <Checkbox checked={task.completed} onChange={() => app.scheduleService.toggleTaskOnDate(dateKey, type, task.id)} />
              <span className={task.completed ? 'is-done' : ''}>{app.scheduleService.taskTitle(task)}</span>
            </label>
          ))}
        </div>
      ))}
    </aside>
  );
}

export function isTodayKey(dateKey) {
  return dateKey === getDateKey(new Date());
}
