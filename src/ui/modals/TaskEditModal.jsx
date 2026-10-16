import React, { useEffect, useRef, useState } from 'react';
import { commitNoteDraft, createNote, normalizeNotes } from '../../domain/schedule/daily-task.js';
import { tagPillStyle } from '../../domain/schedule/fixed-tags.js';
import { getDateKey, parseDateKey } from '../../domain/shared/date-key.js';
import { useApp } from '../app/context.jsx';
import { Modal } from '../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../keyboard/ime-enter.js';

function readTask(app, type, id) {
  const day = app.scheduleService.getCurrentData();
  return (day[type] || []).find((task) => task.id === id) || null;
}

export function TaskEditModal({ type, id, onClose }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const task = type && id ? readTask(app, type, id) : null;
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => getDateKey(app.scheduleService.currentDate));
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [tagIds, setTagIds] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const ignoreNoteBlur = useRef(false);

  useEffect(() => {
    if (!task || !type) return;
    setTitle(task.text || '');
    setTagIds(task.tagIds || []);
    setNotes(normalizeNotes(task.notes, { note: task.note, subtasks: task.subtasks }));
    setNoteDraft('');
    setEditingNoteId(null);
    setEditingNoteText('');
    const clock = new Date(task.time);
    const hh = String(clock.getHours()).padStart(2, '0');
    const mm = String(clock.getMinutes()).padStart(2, '0');
    setDate(getDateKey(app.scheduleService.currentDate));
    setTime(`${hh}:${mm}`);
    setRecurrence(task.recurrence || '');
  }, [type, id, task]);

  if (!type || !id || !task) return null;
  const tags = app.scheduleService.workspace.tags || [];

  function save() {
    const text = title.trim();
    if (!text) {
      window.alert('内容不能为空');
      return;
    }
    const currentKey = app.scheduleService.getDateKey();
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : currentKey;
    const patch = { text, recurrence, tagIds, notes: commitNoteDraft(notesWithEdit(), noteDraft) };
    const base = parseDateKey(dateKey) || new Date(app.scheduleService.currentDate);
    if (time) {
      const [hh, mm] = time.split(':').map((part) => parseInt(part, 10));
      base.setHours(hh, mm, 0, 0);
      patch.time = base.getTime();
    } else if (dateKey !== currentKey) {
      const previous = new Date(task.time);
      base.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
      patch.time = base.getTime();
    }
    const saved = app.scheduleService.moveTaskToDate(type, id, dateKey, patch);
    if (saved?.occupied) {
      window.alert('这一天已经有这条任务');
      return;
    }
    onClose();
  }

  function remove() {
    app.scheduleService.deleteTask(type, id);
    onClose();
  }

  function onFormKeyDown(event) {
    if (event.target.classList.contains('note-input')) return;
    if (event.key !== 'Enter' || event.shiftKey || holdImeEnter(event, ime)) return;
    const target = event.target;
    if (target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.type === 'checkbox') return;
    event.preventDefault();
    save();
  }

  function notesWithEdit(list = notes) {
    if (!editingNoteId) return list;
    const text = editingNoteText.trim();
    if (!text) return list;
    return list.map((item) => (item.id === editingNoteId ? { ...item, text } : item));
  }

  function commitNoteEdit() {
    if (ignoreNoteBlur.current) {
      ignoreNoteBlur.current = false;
      return;
    }
    if (!editingNoteId) return;
    const id = editingNoteId;
    const text = editingNoteText.trim();
    setEditingNoteId(null);
    setEditingNoteText('');
    if (!text) return;
    setNotes((current) => current.map((item) => (item.id === id ? { ...item, text } : item)));
  }

  function startNoteEdit(item) {
    if (editingNoteId === item.id) return;
    const text = editingNoteText.trim();
    const previousId = editingNoteId;
    setNotes((current) => {
      if (!previousId || !text) return current;
      return current.map((note) => (note.id === previousId ? { ...note, text } : note));
    });
    setEditingNoteId(item.id);
    setEditingNoteText(item.text);
  }

  function removeNote(noteId) {
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setEditingNoteText('');
    }
    setNotes((current) => current.filter((item) => item.id !== noteId));
  }

  function onNoteEditKeyDown(event) {
    if (holdImeEnter(event, ime)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      ignoreNoteBlur.current = true;
      setEditingNoteId(null);
      setEditingNoteText('');
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    commitNoteEdit();
    ignoreNoteBlur.current = true;
  }

  function addNote(event) {
    if (holdImeEnter(event, ime)) return;
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    const text = noteDraft.trim();
    if (!text) return;
    setNotes((current) => [...current, createNote(text)]);
    setNoteDraft('');
  }

  return (
    <Modal title="编辑任务" onClose={onClose} wide>
      <form
        className="form-stack"
        {...imeCompositionProps(ime)}
        onSubmit={(event) => { event.preventDefault(); if (ime.shouldIgnoreSubmit()) return; save(); }}
        onKeyDown={onFormKeyDown}
      >
        <label className="field-label">内容
          <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field-label">日期
          <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
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
            <div>
              <span className="field-label">标签</span>
              <div className="tag-board">
                {tags.length === 0 ? <p className="empty">还没有标签。</p> : tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={tagIds.includes(tag.id) ? 'tag-pill is-on' : 'tag-pill'}
                    style={tagPillStyle(tag)}
                    onClick={() => setTagIds((current) => (
                      current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id]
                    ))}
                  >{tag.name}</button>
                ))}
              </div>
            </div>
            <div>
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
                          onKeyDown={onNoteEditKeyDown}
                          onBlur={commitNoteEdit}
                        />
                      ) : (
                        <button type="button" className="note-edit-text" onClick={() => startNoteEdit(item)}>
                          {item.text}
                        </button>
                      )}
                      <button type="button" className="btn btn-quiet btn-danger" onClick={() => removeNote(item.id)}>删除</button>
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
          <button type="button" className="btn" onClick={() => {
            const result = app.taskTransfer.transfer({ from: type, id, to: 'ideas' });
            if (!result.ok && result.error) window.alert(result.error);
            else onClose();
          }}>放入灵感</button>
          <button type="button" className="btn btn-danger" onClick={remove}>删除</button>
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存</button>
        </div>
      </form>
    </Modal>
  );
}
