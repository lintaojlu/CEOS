import React from 'react';
import { weekDays } from '../../../domain/calendar/calendar-grid.js';
import { WEEKDAYS } from '../../components/DateNav.jsx';
import { useApp } from '../../app/context.jsx';
import { Checkbox } from '../../components/Checkbox.jsx';
import { isTodayKey } from './DayDetailPanel.jsx';

export function WeekView({ cursor, selected, onSelect }) {
  const app = useApp();
  const days = weekDays(cursor);
  return (
    <div className="cal-week">
      {days.map((dateKey, index) => {
        const day = app.scheduleService.data[dateKey];
        const summary = app.statsService.daySummary(dateKey);
        const tasks = [
          ...(day?.required || []).map((task) => ({ ...task, type: 'required' })),
          ...(day?.optional || []).map((task) => ({ ...task, type: 'optional' }))
        ];
        return (
          <section key={dateKey} className={dateKey === selected ? 'week-col is-selected' : 'week-col'} onClick={() => onSelect(dateKey)}>
            <div className="cal-num">{WEEKDAYS[index]} {dateKey.slice(5)}{isTodayKey(dateKey) ? ' · 今天' : ''}</div>
            <div className="card-note">{summary.total ? `${Math.round((summary.rate || 0) * 100)}%` : '无任务'}</div>
            {summary.milestones.map((item) => <div key={item.id} className="chip chip-accent" style={{ marginTop: 6 }}>{item.title}</div>)}
            <div style={{ marginTop: 8 }}>
              {tasks.map((task) => (
                <label key={`${task.type}-${task.id}`} className="detail-task" onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={task.completed} onChange={() => app.scheduleService.toggleTaskOnDate(dateKey, task.type, task.id)} />
                  <span className={task.completed ? 'is-done' : ''}>{app.scheduleService.taskTitle(task)}</span>
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
