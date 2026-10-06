import React, { useEffect, useState } from 'react';
import { addDays, getDateKey } from '../../../domain/shared/date-key.js';
import { useApp } from '../../app/context.jsx';
import { Modal } from '../../components/Modal.jsx';

function labelOf(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${dateKey} ${weekdays[date.getDay()]}`;
}

export function SyncTasksModal({ open, onClose }) {
  const app = useApp();
  const currentKey = app.scheduleService.getDateKey();
  const [source, setSource] = useState('');

  useEffect(() => {
    if (open) setSource(getDateKey(addDays(app.scheduleService.currentDate, -1)));
  }, [open, app]);

  if (!open) return null;
  const sources = app.scheduleService.listSyncSources();
  const allowed = /^\d{4}-\d{2}-\d{2}$/.test(source) && source !== currentKey && app.scheduleService.countOpenTasks(source) > 0;
  let hint = '先选择来源日期。';
  if (source === currentKey) hint = '不能从当前查看日同步到自己。';
  else if (source && app.scheduleService.countOpenTasks(source) === 0) hint = '这一天没有未完成的必做或选做。';
  else if (allowed) hint = `把 ${labelOf(source)} 的未完成必做和选做拷到 ${labelOf(currentKey)}。`;

  return (
    <Modal title="同步任务" onClose={onClose}>
      <p className="card-note">只拷贝所选日期里未完成的必做和选做，任务 id 保持不变。</p>
      <label className="field-label" style={{ marginTop: 12 }}>来源日期
        <input className="field" type="date" value={source} onChange={(event) => setSource(event.target.value)} />
      </label>
      <div className="paper-well" style={{ marginTop: 12 }}>
        {sources.length === 0 ? <p className="empty">其他日期没有未完成任务。仍可以直接改上面的日期。</p> : sources.map((row) => (
          <button key={row.dateKey} type="button" className={row.dateKey === source ? 'sync-row is-selected' : 'sync-row'} onClick={() => setSource(row.dateKey)}>
            <span>{labelOf(row.dateKey)}</span>
            <span className="task-time">{row.openCount} 条未完成</span>
          </button>
        ))}
      </div>
      <p className="status-line" style={{ marginTop: 10 }}>{hint}</p>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>取消</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!allowed}
          onClick={() => {
            app.scheduleService.syncTasksFrom(source);
            onClose();
          }}
        >同步</button>
      </div>
    </Modal>
  );
}
