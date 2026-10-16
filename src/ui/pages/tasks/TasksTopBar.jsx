import React, { useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { DateNav, IconButton } from '../../library/index.js';
import { SyncTasksModal } from './SyncTasksModal.jsx';

export function TasksTopBar() {
  const app = useApp();
  const [syncOpen, setSyncOpen] = useState(false);

  function clearDay() {
    if (window.confirm('清空当前日期的必做和选做？灵感不受影响。')) app.scheduleService.clearTodayTasks();
  }

  return (
    <>
      <div className="topbar-tools">
        <DateNav
          date={app.scheduleService.currentDate}
          onPrev={() => app.scheduleService.prevDay()}
          onNext={() => app.scheduleService.nextDay()}
        />
        <div className="topbar-icon-row">
          <button type="button" className="chrome-label is-framed" onClick={() => app.scheduleService.goToday()}>今天</button>
          <IconButton name="sync" label="同步任务" title="同步任务" size={18} onClick={() => setSyncOpen(true)} />
          <IconButton name="delete" label="清空" title="清空" size={18} danger onClick={clearDay} />
        </div>
      </div>
      <SyncTasksModal open={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
}
