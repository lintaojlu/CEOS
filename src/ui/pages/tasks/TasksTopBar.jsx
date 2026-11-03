import React, { useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { DateNav, IconButton, Modal } from '../../library/index.js';
import { SyncTasksModal } from './SyncTasksModal.jsx';

export function TasksTopBar() {
  const app = useApp();
  const [syncOpen, setSyncOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  function confirmClear() {
    app.scheduleService.clearDayTasks();
    setClearOpen(false);
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
          <IconButton name="delete" label="清空当日任务" title="清空当日任务" size={18} danger onClick={() => setClearOpen(true)} />
        </div>
      </div>
      <SyncTasksModal open={syncOpen} onClose={() => setSyncOpen(false)} />
      <Modal title="清空当日任务" open={clearOpen} onClose={() => setClearOpen(false)}>
        <p>清空当前日期的必做和选做？灵感不受影响。</p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={confirmClear}>清空</button>
          <button type="button" className="btn" onClick={() => setClearOpen(false)}>取消</button>
        </div>
      </Modal>
    </>
  );
}
