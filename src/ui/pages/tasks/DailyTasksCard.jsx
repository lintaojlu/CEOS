import React, { useState } from 'react';
import { normalizeTagIds } from '../../../domain/schedule/daily-task.js';
import { useApp } from '../../app/context.jsx';
import { Card } from '../../components/Card.jsx';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../../keyboard/ime-enter.js';
import { TaskRow } from './TaskRow.jsx';

function TaskProgress() {
  const app = useApp();
  const progress = app.scheduleService.getProgress();
  const radius = 15;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (progress.percentage / 100) * circ;
  return (
    <div className="progress-wrap" aria-label={`完成 ${progress.percentage}%`}>
      <svg className="progress-ring" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
        <circle className="progress-track" cx="20" cy="20" r={radius} />
        <circle className="progress-value" cx="20" cy="20" r={radius} strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <span className="progress-percent">{progress.percentage}%</span>
    </div>
  );
}

export function DailyTasksCard({ onEdit, onSync, selectedTagIds = [] }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const data = app.scheduleService.getCurrentData();
  const [over, setOver] = useState('');

  function beginReorder(event, fromType, fromId) {
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;

    function markerAt(clientX, clientY) {
      const hit = document.elementFromPoint(clientX, clientY);
      const row = hit?.closest?.('[data-task-id]');
      if (row) {
        const rect = row.getBoundingClientRect();
        const edge = clientY > rect.top + rect.height / 2 ? 'after' : 'before';
        return { kind: 'row', edge, type: row.getAttribute('data-task-type'), id: row.getAttribute('data-task-id') };
      }
      const zone = hit?.closest?.('[data-drop-type]');
      if (zone) return { kind: 'zone', type: zone.getAttribute('data-drop-type') };
      return null;
    }

    function show(marker) {
      if (!marker) {
        setOver('');
        return;
      }
      if (marker.kind === 'zone') {
        setOver(marker.type);
        return;
      }
      setOver(`${marker.edge}:${marker.type}:${marker.id}`);
    }

    function move(moveEvent) {
      if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
      active = true;
      moveEvent.preventDefault();
      show(markerAt(moveEvent.clientX, moveEvent.clientY));
    }

    function up(upEvent) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setOver('');
      if (!active) return;
      const marker = markerAt(upEvent.clientX, upEvent.clientY);
      if (!marker) return;
      if (marker.kind === 'zone') {
        app.scheduleService.placeTask(fromType, fromId, marker.type, null);
        return;
      }
      const list = app.scheduleService.getCurrentData()[marker.type] || [];
      const index = list.findIndex((task) => task.id === marker.id);
      const beforeId = marker.edge === 'after' ? (list[index + 1]?.id ?? null) : marker.id;
      app.scheduleService.placeTask(fromType, fromId, marker.type, beforeId);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function add(event, type) {
    if (event.key !== 'Enter' || holdImeEnter(event, ime)) return;
    const text = event.currentTarget.value.trim();
    if (!text) return;
    app.scheduleService.addTask(type, text, selectedTagIds);
    event.currentTarget.value = '';
  }

  function visibleTasks(type) {
    const seen = new Set();
    const tasks = [];
    (data[type] || []).forEach((task) => {
      if (!task?.id || seen.has(task.id)) return;
      seen.add(task.id);
      tasks.push(task);
    });
    if (selectedTagIds.length === 0) return tasks;
    const selected = new Set(selectedTagIds);
    return tasks.filter((task) => normalizeTagIds(task).some((id) => selected.has(id)));
  }

  return (
    <Card
      title="任务清单"
      titleAside={<TaskProgress />}
      actions={(
        <>
          <button type="button" className="btn btn-mono" onClick={onSync}>同步任务</button>
          <button
            type="button"
            className="btn btn-quiet btn-danger btn-mono"
            onClick={() => {
              if (window.confirm('清空当前日期的必做和选做？收集箱不受影响。')) app.scheduleService.clearTodayTasks();
            }}
          >清空</button>
        </>
      )}
    >
      <div className="columns-2">
        {[['required', '必做'], ['optional', '选做']].map(([type, label]) => (
          <div key={type}>
            <div className="column-title"><span>{label}</span></div>
            <input className="field" style={{ marginBottom: 8 }} placeholder={`添加${label}，回车确认`} {...imeCompositionProps(ime)} onKeyDown={(event) => add(event, type)} />
            <div
              className={over === type ? 'drop-zone is-over task-list' : 'drop-zone task-list'}
              data-drop-type={type}
            >
              {(visibleTasks(type)).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  type={type}
                  onEdit={onEdit}
                  dropEdge={over === `before:${type}:${task.id}` ? 'before' : over === `after:${type}:${task.id}` ? 'after' : ''}
                  onReorderStart={beginReorder}
                />
              ))}
              {(data[type] || []).length === 0 ? <p className="empty">这一列是空的。</p> : visibleTasks(type).length === 0 ? <p className="empty">没有符合的任务。</p> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
