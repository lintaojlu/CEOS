import React from 'react';
import { useApp } from '../../app/context.jsx';
import { Checkbox } from '../../components/Checkbox.jsx';

export function IdeaListView({ onEdit, filter }) {
  const app = useApp();
  const { ready, waiting, completed } = app.ideaInboxService.partition();

  function renderIdea(idea, status) {
    const blockers = status === 'waiting' ? app.ideaInboxService.getBlockers(idea.id) : null;
    return (
      <div key={idea.id} className="task-row" onDoubleClick={() => onEdit(idea.id)}>
        <Checkbox checked={idea.completed} onChange={() => app.ideaInboxService.toggleComplete(idea.id)} />
        <div className="task-main">
          <div className="task-line">
            <span className={idea.completed ? 'task-title is-done' : 'task-title'}>{idea.text}</span>
            {status === 'waiting' && blockers?.waitingPreds.length ? <span className="chip">等前序</span> : null}
            {status === 'waiting' && blockers?.waitingDueDate ? <span className="chip">等 {blockers.waitingDueDate}</span> : null}
            {status === 'ready' && idea.dueDate ? <span className="chip chip-accent">DDL {idea.dueDate}</span> : null}
          </div>
          {idea.note ? <div className="card-note">{idea.note}</div> : null}
        </div>
        {status === 'ready' ? (
          <button type="button" className="btn btn-mono" onClick={() => {
            const result = app.ideaInboxService.pickUp(idea.id, 'required');
            if (result && result.error) window.alert(result.error);
          }}>列入今日</button>
        ) : null}
      </div>
    );
  }

  const groups = [
    ['ready', '可捡起', filter.ready ? ready : []],
    ['completed', '已完成', filter.completed ? completed : []],
    ['waiting', '等待中', filter.waiting ? waiting : []]
  ];
  const visibleCount = groups.reduce((sum, [, , list]) => sum + list.length, 0);
  const total = ready.length + waiting.length + completed.length;

  return (
    <div>
      {visibleCount === 0 ? (
        <p className="empty">{total === 0 ? '暂无灵感。把暂时做不了的事放这里，设好前序或日期后再捡起来。' : '当前筛选下没有任务。'}</p>
      ) : groups.map(([status, label, list]) => list.length ? (
        <div key={status}>
          <div className={status === 'ready' ? 'group-label group-label-accent' : 'group-label'}>{label}（{list.length}）</div>
          {list.map((idea) => renderIdea(idea, status))}
        </div>
      ) : null)}
    </div>
  );
}
