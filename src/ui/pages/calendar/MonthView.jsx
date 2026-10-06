import React from 'react';
import { monthGrid } from '../../../domain/calendar/calendar-grid.js';
import { WEEKDAYS } from '../../components/DateNav.jsx';
import { useApp } from '../../app/context.jsx';
import { isTodayKey } from './DayDetailPanel.jsx';

export function MonthView({ cursor, selected, onSelect }) {
  const app = useApp();
  const weeks = monthGrid(cursor.getFullYear(), cursor.getMonth() + 1);
  return (
    <div>
      <div className="cal-weekdays">
        {WEEKDAYS.map((label) => <div key={label} className="cal-weekday">{label}</div>)}
      </div>
      {weeks.map((week) => (
        <div key={week[0].dateKey} className="cal-week" style={{ marginTop: 6 }}>
          {week.map((cell) => {
            const summary = app.statsService.daySummary(cell.dateKey);
            const dayNum = Number(cell.dateKey.slice(-2));
            return (
              <button
                key={cell.dateKey}
                type="button"
                className={[
                  'cal-cell',
                  cell.inMonth ? '' : 'is-out',
                  cell.dateKey === selected ? 'is-selected' : '',
                  isTodayKey(cell.dateKey) ? 'is-today' : ''
                ].join(' ')}
                onClick={() => onSelect(cell.dateKey)}
              >
                <div className="cal-num">{dayNum}</div>
                <span className={`cal-bar heat-${summary.level}`} />
                <div className="cal-meta">
                  {summary.requiredCount ? <span className="chip">{summary.requiredCount} 必做</span> : null}
                  {summary.optionalCount ? <span className="chip">{summary.optionalCount} 选做</span> : null}
                  {summary.milestones.slice(0, 1).map((item) => <span key={item.id} className="chip chip-accent">{item.title}</span>)}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
