import React from 'react';
import { normalizeSubtasks } from '../../../domain/schedule/daily-task.js';
import { todayKey } from '../../../domain/shared/date-key.js';
import { useApp } from '../../app/context.jsx';
import { navigate } from '../../app/router.js';
import { Card } from '../../components/Card.jsx';
import { Checkbox } from '../../components/Checkbox.jsx';
import { TaskText } from '../tasks/TaskText.jsx';

export function PomodoroPage() {
  const app = useApp();
  const snap = app.pomodoroService.getSnapshot();
  const incomplete = app.pomodoroService.listTodayIncomplete();
  const required = incomplete.filter((item) => item.list === 'required');
  const optional = incomplete.filter((item) => item.list === 'optional');
  const task = snap.activeTask;
  const title = task ? app.scheduleService.taskTitle(task) : snap.phase === 'idle' ? '选择一条今天的未完成任务' : '任务已不存在';
  const phaseLabel = snap.phase === 'work' ? '专注中' : snap.phase === 'break' ? '休息中' : '待开始';
  const subtasks = task ? normalizeSubtasks(task.subtasks) : [];

  function isSelected(list, id) {
    if (snap.session?.pendingTaskId) return snap.session.pendingTaskId === id && snap.session.pendingList === list;
    if (snap.session) return snap.session.taskId === id && snap.session.list === list;
    return snap.selected?.taskId === id && snap.selected?.list === list;
  }

  function toggleSub(subId) {
    if (!task) return;
    app.scheduleService.toggleSubtaskOnDate(snap.activeDateKey || todayKey(), snap.activeList, task.id, subId);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="page-kicker">Pomodoro</p>
          <h1 className="page-title">番茄钟</h1>
        </div>
      </header>
      <div className="columns-2">
        <Card title="这一轮" note={phaseLabel}>
          <div className="pomo-timer">{snap.remainingLabel}</div>
          <p className={task ? 'pomo-task-title' : 'empty'}>{title}</p>
          <div className="card-actions" style={{ marginTop: 12 }}>
            {snap.phase === 'idle' ? (
              <button type="button" className="btn btn-primary" disabled={!snap.selected} onClick={() => app.pomodoroService.start()}>开始</button>
            ) : null}
            {snap.phase === 'work' ? (
              <button type="button" className="btn btn-quiet btn-danger" onClick={() => app.pomodoroService.abandon()}>放弃</button>
            ) : null}
            {snap.phase === 'break' ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => app.pomodoroService.skipBreak()}>跳过休息</button>
                <button type="button" className="btn btn-quiet" onClick={() => app.pomodoroService.abandon()}>放弃</button>
              </>
            ) : null}
          </div>
          {task ? (
            <div className="subtasks" style={{ marginTop: 16 }}>
              {subtasks.length === 0 ? <p className="empty">暂无子任务</p> : null}
              {subtasks.map((sub) => (
                <div key={sub.id} className="sub-row">
                  <Checkbox checked={sub.completed} onChange={() => toggleSub(sub.id)} />
                  <span className={sub.completed ? 'is-done' : ''}>{sub.text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
        <Card title="今天的未完成任务" note="番茄钟始终对着真实的今天。">
          {incomplete.length === 0 ? (
            <p className="empty">
              今天没有未完成的必做或选做。
              <button type="button" className="btn btn-mono" style={{ marginLeft: 8 }} onClick={() => navigate('tasks')}>去任务页添加</button>
            </p>
          ) : (
            <>
              {[['必做', required], ['选做', optional]].map(([label, rows]) => (
                rows.length ? (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div className="column-title"><span>{label}</span></div>
                    {rows.map(({ list, task: item }) => {
                      const count = typeof item.pomodoros === 'number' && item.pomodoros > 0 ? item.pomodoros : 0;
                      const docked = snap.session?.pendingTaskId === item.id && snap.session?.pendingList === list;
                      return (
                        <button
                          key={`${list}:${item.id}`}
                          type="button"
                          className={isSelected(list, item.id) ? 'pomo-pick is-selected' : 'pomo-pick'}
                          onClick={() => app.pomodoroService.selectTask(list, item.id)}
                        >
                          <span className="pomo-pick-title"><TaskText text={app.scheduleService.taskTitle(item)} /></span>
                          {docked ? <span className="chip">休息后</span> : null}
                          {count > 0 ? <span className="pomo-count">{count}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null
              ))}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
