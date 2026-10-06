import React, { useEffect, useState } from 'react';
import { taskRefKey } from '../../domain/ideas/idea-node.js';
import { useApp } from '../app/context.jsx';
import { Modal } from '../components/Modal.jsx';

function readTask(app, type, id) {
  if (type === 'ideas') return app.ideaInboxService.getNodes().find((idea) => idea.id === id) || null;
  const day = app.scheduleService.getCurrentData();
  return (day[type] || []).find((task) => task.id === id) || null;
}

export function TaskEditModal({ type, id, onClose }) {
  const app = useApp();
  const task = type && id ? readTask(app, type, id) : null;
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [deps, setDeps] = useState([]);

  useEffect(() => {
    if (!task || !type) return;
    setTitle(type === 'ideas' ? task.text || '' : app.scheduleService.taskTitle(task));
    setNote(task.note || '');
    if (type === 'ideas') {
      setDueDate(task.dueDate || '');
      setDeps(task.dependsOn || []);
    } else {
      const date = new Date(task.time);
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm}`);
      setRecurrence(task.recurrence || '');
    }
  }, [app, type, id, task]);

  if (!type || !id || !task) return null;
  const candidates = type === 'ideas' ? app.ideaInboxService.listPredecessorCandidates(id) : [];
  const selected = new Set(deps.map(taskRefKey));

  function toggleDep(candidate) {
    const key = taskRefKey(candidate);
    setDeps((current) => {
      const exists = current.some((item) => taskRefKey(item) === key);
      if (exists) return current.filter((item) => taskRefKey(item) !== key);
      if (candidate.scope === 'idea') return [...current, { scope: 'idea', id: candidate.id }];
      return [...current, { scope: 'daily', dateKey: candidate.dateKey, list: candidate.list, id: candidate.id }];
    });
  }

  function save() {
    const text = title.trim();
    if (!text) {
      window.alert('内容不能为空');
      return;
    }
    if (type === 'ideas') {
      const result = app.ideaInboxService.update(id, { text, note, dueDate: dueDate || null, dependsOn: deps });
      if (result && result.error) {
        window.alert(result.error);
        return;
      }
      onClose();
      return;
    }
    const patch = { text, note, recurrence };
    if (time) {
      const [hh, mm] = time.split(':').map((part) => parseInt(part, 10));
      const base = new Date(app.scheduleService.currentDate);
      base.setHours(hh, mm, 0, 0);
      patch.time = base.getTime();
    }
    app.scheduleService.updateTask(type, id, patch);
    onClose();
  }

  function remove() {
    if (type === 'ideas') app.ideaInboxService.delete(id);
    else app.scheduleService.deleteTask(type, id);
    onClose();
  }

  function onFormKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    const target = event.target;
    if (target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.type === 'checkbox') return;
    event.preventDefault();
    save();
  }

  return (
    <Modal title={type === 'ideas' ? '编辑灵感' : '编辑任务'} onClose={onClose} wide>
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); save(); }} onKeyDown={onFormKeyDown}>
        <label className="field-label">内容
          <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        {type !== 'ideas' ? (
          <>
            <label className="field-label">时间
              <input className="field" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
            <label className="field-label">周期
              <select className="select" value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
                <option value="">无</option>
                <option value="daily">每日</option>
                <option value="weekdays">每个工作日</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="field-label">DDL（可捡起日期）
              <input className="field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <div>
              <span className="field-label">前序</span>
              <div className="paper-well">
                {candidates.length === 0 ? <p className="empty">没有其他未完成灵感，当天也没有未完成任务。</p> : candidates.map((candidate) => (
                  <label key={taskRefKey(candidate)} className="sub-row">
                    <input type="checkbox" className="checkbox" checked={selected.has(taskRefKey(candidate))} onChange={() => toggleDep(candidate)} />
                    <span>{candidate.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        <label className="field-label">说明
          <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="form-actions">
          {type !== 'ideas' ? (
            <button type="button" className="btn" onClick={() => {
              const result = app.taskTransfer.transfer({ from: type, id, to: 'ideas' });
              if (!result.ok && result.error) window.alert(result.error);
              else onClose();
            }}>放入收集箱</button>
          ) : null}
          <button type="button" className="btn btn-danger" onClick={remove}>删除</button>
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存</button>
        </div>
      </form>
    </Modal>
  );
}
