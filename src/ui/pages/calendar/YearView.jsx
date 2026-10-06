import React from 'react';
import { yearMonths } from '../../../domain/calendar/calendar-grid.js';
import { useApp } from '../../app/context.jsx';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function YearView({ cursor, onOpenMonth }) {
  const app = useApp();
  const months = yearMonths(cursor.getFullYear());
  return (
    <div className="year-grid">
      {months.map((month) => (
        <button key={month.month} type="button" className="mini-month" onClick={() => onOpenMonth(month.month)}>
          <strong>{MONTHS[month.month - 1]}</strong>
          <div className="mini-grid">
            {month.weeks.flat().map((cell) => {
              const summary = cell.inMonth ? app.statsService.daySummary(cell.dateKey) : null;
              return (
                <span
                  key={cell.dateKey}
                  className={cell.inMonth ? `mini-cell in heat-${summary.level}` : 'mini-cell'}
                  title={cell.dateKey}
                />
              );
            })}
          </div>
        </button>
      ))}
    </div>
  );
}
