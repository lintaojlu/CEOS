import React, { useState } from 'react';
import { addDays, getDateKey, parseDateKey } from '../../../domain/shared/date-key.js';
import { useApp } from '../../app/context.jsx';
import { navigate } from '../../app/router.js';
import { DateNav } from '../../components/DateNav.jsx';
import { SegmentedControl } from '../../components/SegmentedControl.jsx';
import { DayDetailPanel } from './DayDetailPanel.jsx';
import { MonthView } from './MonthView.jsx';
import { WeekView } from './WeekView.jsx';
import { YearView } from './YearView.jsx';

function shift(date, mode, direction) {
  if (mode === 'week') return addDays(date, direction * 7);
  if (mode === 'year') return new Date(date.getFullYear() + direction, date.getMonth(), 1, 12);
  return new Date(date.getFullYear(), date.getMonth() + direction, 1, 12);
}

function subtitle(date, mode) {
  if (mode === 'year') return `${date.getFullYear()}年`;
  if (mode === 'week') return '这一周';
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function CalendarPage() {
  const app = useApp();
  const mode = app.uiPrefs.get().calendarMode;
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => getDateKey(new Date()));

  function openInTasks(dateKey) {
    const date = parseDateKey(dateKey);
    if (date) app.scheduleService.setCurrentDate(date);
    navigate('tasks');
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="page-kicker">Calendar</p>
          <h1 className="page-title">日历</h1>
        </div>
        <div className="card-actions">
          <SegmentedControl
            label="日历粒度"
            value={mode}
            options={[{ id: 'week', label: '周' }, { id: 'month', label: '月' }, { id: 'year', label: '年' }]}
            onChange={(next) => app.uiPrefs.update({ calendarMode: next })}
          />
          <DateNav
            date={cursor}
            subtitle={subtitle(cursor, mode)}
            onPrev={() => setCursor((date) => shift(date, mode, -1))}
            onNext={() => setCursor((date) => shift(date, mode, 1))}
            onToday={() => {
              const now = new Date();
              setCursor(now);
              setSelected(getDateKey(now));
            }}
          />
        </div>
      </header>
      <div className={mode === 'month' ? 'calendar-layout' : 'calendar-layout is-year'}>
        <section className="card">
          {mode === 'month' ? <MonthView cursor={cursor} selected={selected} onSelect={setSelected} /> : null}
          {mode === 'week' ? <WeekView cursor={cursor} selected={selected} onSelect={setSelected} /> : null}
          {mode === 'year' ? (
            <YearView
              cursor={cursor}
              onOpenMonth={(month) => {
                setCursor(new Date(cursor.getFullYear(), month - 1, 1, 12));
                app.uiPrefs.update({ calendarMode: 'month' });
              }}
            />
          ) : null}
        </section>
        {mode === 'month' ? <DayDetailPanel dateKey={selected} onOpenTasks={openInTasks} /> : null}
      </div>
    </div>
  );
}
