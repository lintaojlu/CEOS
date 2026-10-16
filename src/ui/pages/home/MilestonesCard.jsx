import React, { useState } from 'react';
import { getDateKey } from '../../../domain/shared/date-key.js';
import { useApp } from '../../app/context.jsx';
import { Card, DeleteButton, Icon, Modal } from '../../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../../keyboard/ime-enter.js';

function statusOf(milestone, today) {
  const target = new Date(`${milestone.date}T12:00:00`);
  const now = new Date(`${today}T12:00:00`);
  const daysLeft = Math.round((target - now) / 86400000);
  if (milestone.completed) return { text: '已完成', chip: 'chip chip-good', dot: 'dot is-done' };
  if (daysLeft < 0) return { text: `已过 ${Math.abs(daysLeft)} 天`, chip: 'chip chip-bad', dot: 'dot is-late' };
  if (daysLeft === 0) return { text: '今天', chip: 'chip chip-accent', dot: 'dot' };
  return { text: `还有 ${daysLeft} 天`, chip: daysLeft <= 3 ? 'chip chip-accent' : 'chip', dot: 'dot' };
}

export function MilestonesCard() {
  const app = useApp();
  const ime = useImeEnterGuard();
  const [editing, setEditing] = useState(null);
  const today = getDateKey(new Date());
  const milestones = [...app.milestoneService.milestones].sort((a, b) => {
    const aPast = a.date < today;
    const bPast = b.date < today;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return a.date.localeCompare(b.date);
  });

  function save(event) {
    event.preventDefault();
    if (ime.shouldIgnoreSubmit()) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') || '').trim();
    const date = String(data.get('date') || '');
    if (!title || !date) return;
    if (editing.id) app.milestoneService.update(editing.id, title, date);
    else app.milestoneService.add(title, date);
    setEditing(null);
  }

  return (
    <Card
      title="目标里程碑"
      note="全局一条时间轴，不随查看的日期切换。"
      actions={<button type="button" className="btn btn-icon" aria-label="添加里程碑" onClick={() => setEditing({ id: '', title: '', date: today })}><Icon name="plus" /></button>}
    >
      {milestones.length === 0 ? <p className="empty">还没有里程碑。</p> : (
        <div className="milestone-scroller">
          {milestones.map((milestone) => {
            const status = statusOf(milestone, today);
            return (
              <button key={milestone.id} type="button" className={editing?.id === milestone.id ? 'milestone-card is-on' : 'milestone-card'} onClick={() => setEditing(milestone)}>
                <span className={status.dot} />
                <span>
                  <strong className={milestone.completed ? 'task-title is-done' : 'task-title'}>{milestone.title}</strong>
                  <span className="task-line" style={{ marginTop: 6 }}>
                    <span className="task-time">{milestone.date}</span>
                    <span className={status.chip}>{status.text}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {editing ? (
        <Modal title={editing.id ? '编辑里程碑' : '添加里程碑'} onClose={() => setEditing(null)}>
          <form className="form-stack" {...imeCompositionProps(ime)} onKeyDown={(event) => { holdImeEnter(event, ime); }} onSubmit={save}>
            <label className="field-label">目标名称
              <input className="field" name="title" defaultValue={editing.title} autoFocus />
            </label>
            <label className="field-label">目标日期
              <input className="field" type="date" name="date" defaultValue={editing.date} />
            </label>
            <div className="form-actions">
              {editing.id ? (
                <DeleteButton onClick={() => { app.milestoneService.delete(editing.id); setEditing(null); }} />
              ) : null}
              <button type="button" className="btn" onClick={() => setEditing(null)}>取消</button>
              <button type="submit" className="btn btn-primary">保存</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}
