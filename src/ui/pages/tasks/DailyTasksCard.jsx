import React, { useEffect, useRef, useState } from 'react';
import { normalizeTagIds } from '../../../domain/schedule/daily-task.js';
import { useApp } from '../../app/context.jsx';
import { Card } from '../../library/index.js';
import { TASK_LIST_HEIGHT, normalizeTaskListHeight } from '../../../infrastructure/storage/ui-prefs-repository.js';
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

function visibleTaskListMax() {
  const cap = Math.round(window.innerHeight * 0.72);
  return Math.max(TASK_LIST_HEIGHT.min, Math.min(TASK_LIST_HEIGHT.max, cap));
}

function clampTaskListHeight(value) {
  return Math.min(visibleTaskListMax(), Math.max(TASK_LIST_HEIGHT.min, normalizeTaskListHeight(value)));
}

export function DailyTasksCard({ onEdit, onSync, selectedTagIds = [] }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const data = app.scheduleService.getCurrentData();
  const [over, setOver] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const preferredHeight = useRef(normalizeTaskListHeight(app.uiPrefs.get().taskListHeight));
  const [listHeight, setListHeight] = useState(() => clampTaskListHeight(preferredHeight.current));

  useEffect(() => {
    function onResize() {
      setListHeight(clampTaskListHeight(preferredHeight.current));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function beginResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = preferredHeight.current;
    document.body.classList.add('is-task-list-resizing');

    function move(moveEvent) {
      moveEvent.preventDefault();
      const next = clampTaskListHeight(startHeight + (moveEvent.clientY - startY));
      preferredHeight.current = next;
      setListHeight(next);
    }

    function up(upEvent) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('is-task-list-resizing');
      const next = clampTaskListHeight(startHeight + (upEvent.clientY - startY));
      preferredHeight.current = next;
      setListHeight(next);
      app.uiPrefs.update({ taskListHeight: next });
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function beginReorder(event, fromType, fromId) {
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;

    function markerAt(clientX, clientY) {
      const zone = [...document.querySelectorAll('[data-drop-type]')].find((node) => {
        const rect = node.getBoundingClientRect();
        return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      });
      if (!zone) return null;
      const type = zone.getAttribute('data-drop-type');
      const blocks = [...zone.querySelectorAll(':scope > .task-block')];
      if (!blocks.length) return { kind: 'zone', type };
      let index = blocks.length;
      for (let i = 0; i < blocks.length; i += 1) {
        const rect = blocks[i].getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          index = i;
          break;
        }
      }
      if (index >= blocks.length) {
        const last = blocks[blocks.length - 1].querySelector('[data-task-id]');
        return { kind: 'row', edge: 'after', type, id: last.getAttribute('data-task-id') };
      }
      const row = blocks[index].querySelector('[data-task-id]');
      return { kind: 'row', edge: 'before', type, id: row.getAttribute('data-task-id') };
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
      if (!active) {
        active = true;
        document.body.classList.add('is-task-dragging');
        window.getSelection()?.removeAllRanges();
        setDraggingId(fromId);
      }
      moveEvent.preventDefault();
      show(markerAt(moveEvent.clientX, moveEvent.clientY));
    }

    function up(upEvent) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('is-task-dragging');
      setDraggingId('');
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
    window.addEventListener('pointercancel', up);
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
      className="task-board"
      title="任务清单"
      titleAside={<TaskProgress />}
      actions={(
        <>
          <button type="button" className="btn btn-mono" onClick={onSync}>同步任务</button>
          <button
            type="button"
            className="btn btn-quiet btn-danger btn-mono"
            onClick={() => {
              if (window.confirm('清空当前日期的必做和选做？灵感不受影响。')) app.scheduleService.clearTodayTasks();
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
              style={{ height: listHeight }}
            >
              {(visibleTasks(type)).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  type={type}
                  onEdit={onEdit}
                  dragging={draggingId === task.id}
                  dropEdge={over === `before:${type}:${task.id}` ? 'before' : over === `after:${type}:${task.id}` ? 'after' : ''}
                  onReorderStart={beginReorder}
                />
              ))}
              {(data[type] || []).length === 0 ? <p className="empty">这一列是空的。</p> : visibleTasks(type).length === 0 ? <p className="empty">没有符合的任务。</p> : null}
            </div>
          </div>
        ))}
      </div>
      <div
        className="task-list-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="调整任务清单高度"
        aria-valuemin={TASK_LIST_HEIGHT.min}
        aria-valuemax={visibleTaskListMax()}
        aria-valuenow={listHeight}
        onPointerDown={beginResize}
      />
    </Card>
  );
}
