import React, { useEffect, useRef, useState } from 'react';
import { commitNoteDraft, createNote, normalizeNotes } from '../../../domain/schedule/daily-task.js';
import { covers, findScheduleTask } from '../../../domain/schedule/schedule-document.js';
import { tagPillStyle } from '../../../domain/schedule/fixed-tags.js';
import { todayKey } from '../../../domain/shared/date-key.js';
import { useApp } from '../../app/context.jsx';
import { Modal } from '../../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../../keyboard/ime-enter.js';
import { TaskNoteCards } from './TaskRow.jsx';

function minutesLabel(minutes) {
  const value = Number.isInteger(minutes) ? minutes : 0;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function TaskDrawer({ open = false, type, id, onClose }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const live = type && id ? findScheduleTask(app.scheduleService.data, id) : null;
  const shown = live && live.list === type ? live : null;
  const held = useRef(shown);
  if (shown) held.current = shown;
  const task = shown || held.current;
  const [title, setTitle] = useState(task?.text || '');
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  useEffect(() => {
    setTitle(task?.text || '');
    setNoteDraft('');
    setEditingNoteId(null);
    setEditingNoteText('');
  }, [type, id]);

  const viewed = app.scheduleService.getDateKey();
  const tags = app.scheduleService.workspace.tags || [];
  const notes = task ? normalizeNotes(task.notes, task) : [];

  function save(patch) {
    const saved = app.scheduleService.updateTask(type, id, patch);
    if (!saved) return;
    if (!covers(saved, viewed)) onClose();
  }

  function commitTitle() {
    const text = title.trim();
    if (!text) {
      setTitle(task?.text || '');
      return;
    }
    if (text !== task?.text) save({ text });
  }

  function notesWithEdit() {
    if (!editingNoteId) return notes;
    const text = editingNoteText.trim();
    if (!text) return notes;
    return notes.map((item) => (item.id === editingNoteId ? { ...item, text } : item));
  }

  function commitNoteEdit() {
    if (!editingNoteId) return;
    const text = editingNoteText.trim();
    setEditingNoteId(null);
    setEditingNoteText('');
    if (!text) return;
    save({ notes: notes.map((item) => (item.id === editingNoteId ? { ...item, text } : item)) });
  }

  function addNote(event) {
    if (holdImeEnter(event, ime)) return;
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    const text = noteDraft.trim();
    if (!text) return;
    save({ notes: commitNoteDraft([...notesWithEdit(), createNote(text)], '') });
    setNoteDraft('');
  }

  function setStart(dateKey) {
    if (!dateKey) return;
    if (task.due && dateKey > task.due) return;
    save({ start: dateKey });
  }

  function setDue(dateKey) {
    if (dateKey && dateKey < task.start) return;
    save({ due: dateKey });
  }

  function toIdea() {
    const result = app.taskTransfer.transfer({ from: type, id, to: 'ideas' });
    if (!result.ok && result.error) window.alert(result.error);
    else onClose();
  }

  return (
    <Modal title="编辑任务" open={open && !!shown} onClose={onClose} wide>
      {task ? (
        <div className="form-stack" {...imeCompositionProps(ime)}>
          <label className="field-label">内容
            <input
              className="field"
              value={title}
              aria-label="标题"
              onChange={(event) => setTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || holdImeEnter(event, ime)) return;
                event.preventDefault();
                event.currentTarget.blur();
              }}
            />
          </label>
          <label className="field-label">开始日期
            <input className="field" type="date" value={task.start} max={task.due || undefined} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label className="field-label">截止日期
            <input className="field" type="date" value={task.due} min={task.start} onChange={(event) => setDue(event.target.value)} />
          </label>
          {task.due ? <button type="button" className="btn btn-quiet" onClick={() => save({ due: '' })}>清除截止日期</button> : null}
          <label className="field-label">时间
            <input
              className="field"
              type="time"
              value={minutesLabel(task.minutes)}
              onChange={(event) => {
                const [hh, mm] = event.target.value.split(':').map((part) => parseInt(part, 10));
                if (Number.isInteger(hh) && Number.isInteger(mm)) save({ minutes: hh * 60 + mm });
              }}
            />
          </label>
          <label className="field-label">周期
            <select className="select" value={task.recurrence || ''} onChange={(event) => save({ recurrence: event.target.value })}>
              <option value="">无</option>
              <option value="daily">每日</option>
              <option value="weekdays">每个工作日</option>
            </select>
          </label>
          <div>
            <span className="field-label">标签</span>
            <div className="tag-board">
              {tags.length === 0 ? <p className="empty">还没有标签。</p> : tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={(task.tagIds || []).includes(tag.id) ? 'tag-pill is-on' : 'tag-pill'}
                  style={tagPillStyle(tag)}
                  onClick={() => {
                    const current = task.tagIds || [];
                    const tagIds = current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id];
                    save({ tagIds });
                  }}
                >{tag.name}</button>
              ))}
            </div>
          </div>
          <div {...imeCompositionProps(ime)}>
            <span className="field-label">说明</span>
            {notes.length ? (
              <div className="note-edit-list">
                {notes.map((item) => (
                  <div key={item.id} className="note-edit-item">
                    {editingNoteId === item.id ? (
                      <textarea
                        className="field note-input note-edit-field"
                        rows={Math.min(6, Math.max(1, editingNoteText.split('\n').length))}
                        value={editingNoteText}
                        autoFocus
                        aria-label="编辑说明"
                        onChange={(event) => setEditingNoteText(event.target.value)}
                        onBlur={commitNoteEdit}
                        onKeyDown={(event) => {
                          if (holdImeEnter(event, ime)) return;
                          if (event.key === 'Escape') {
                            setEditingNoteId(null);
                            setEditingNoteText('');
                          }
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            commitNoteEdit();
                          }
                        }}
                      />
                    ) : (
                      <div
                        className="note-edit-card"
                        onClick={(event) => {
                          if (event.target.closest('button')) return;
                          setEditingNoteId(item.id);
                          setEditingNoteText(item.text);
                        }}
                      >
                        <TaskNoteCards
                          notes={[item]}
                          onFocus={app.scheduleService.getDateKey() === todayKey() && !task.completed
                            ? () => app.pomodoroService.focusTask(type, id)
                            : null}
                        />
                      </div>
                    )}
                    <button type="button" className="btn btn-quiet btn-danger" onClick={() => save({ notes: notes.filter((note) => note.id !== item.id) })}>删除</button>
                  </div>
                ))}
              </div>
            ) : <p className="empty">还没有说明。</p>}
            <textarea
              className="field note-input"
              rows={1}
              placeholder="新建说明，回车确认，Shift+回车换行"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              onKeyDown={addNote}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={toIdea}>放入灵感</button>
            <button type="button" className="btn btn-danger" onClick={() => { app.scheduleService.deleteTask(type, id); onClose(); }}>删除</button>
            <button type="button" className="btn" onClick={onClose}>关闭</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
