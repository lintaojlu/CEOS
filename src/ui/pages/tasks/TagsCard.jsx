import React, { useRef, useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { tagPillStyle } from '../../../domain/schedule/fixed-tags.js';
import { DeleteButton, IconButton, Modal, Symbol } from '../../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../../keyboard/ime-enter.js';

export function TagsCard({ tags = [], selectedIds, onToggle }) {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const clickTimer = useRef(0);
  const editing = tags.find((tag) => tag.id === editingId) || null;
  const selected = new Set(selectedIds);

  function clickTag(id) {
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => onToggle(id), 220);
  }

  function editTag(id) {
    window.clearTimeout(clickTimer.current);
    setEditingId(id);
  }

  return (
    <section className="tag-block">
      <div className="tag-head">
        <h2 className="card-title">标签</h2>
        <IconButton name="plus" label="新建标签" title="新建标签" size={18} onClick={() => setAdding(true)} />
      </div>
      <div className="tag-board">
        {tags.map((tag) => (
          <span key={tag.id} className={tag.pinned ? 'tag-pill-wrap is-pinned' : 'tag-pill-wrap'}>
            <button
              type="button"
              className={selected.has(tag.id) ? 'tag-pill is-on' : 'tag-pill'}
              style={tagPillStyle(tag)}
              onClick={() => clickTag(tag.id)}
              onDoubleClick={() => editTag(tag.id)}
            >{tag.name}</button>
            <button
              type="button"
              className={tag.pinned ? 'tag-pin is-on' : 'tag-pin'}
              aria-label={tag.pinned ? '取消钉住' : '钉住标签'}
              aria-pressed={tag.pinned === true}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                app.scheduleService.toggleTagPin(tag.id);
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <Symbol name="pin" size={12} />
            </button>
          </span>
        ))}
      </div>
      {adding ? <TagCreateModal onClose={() => setAdding(false)} /> : null}
      {editing ? <TagEditModal tag={editing} onClose={() => setEditingId(null)} /> : null}
    </section>
  );
}

function TagCreateModal({ onClose }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const [name, setName] = useState('');

  function save(event) {
    event.preventDefault();
    if (ime.shouldIgnoreSubmit()) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!app.scheduleService.addTag(trimmed)) {
      window.alert('名称无效，或已有同名标签');
      return;
    }
    onClose();
  }

  return (
    <Modal title="新建标签" onClose={onClose}>
      <form className="form-stack" {...imeCompositionProps(ime)} onKeyDown={(event) => { holdImeEnter(event, ime); }} onSubmit={save}>
        <label className="field-label">名称
          <input
            className="field"
            value={name}
            autoFocus
            placeholder="标签名"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">创建</button>
        </div>
      </form>
    </Modal>
  );
}

function TagEditModal({ tag, onClose }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const [name, setName] = useState(tag.name);

  function save() {
    if (!app.scheduleService.renameTag(tag.id, name)) {
      window.alert('名称无效，或已有同名标签');
      return;
    }
    onClose();
  }

  function remove() {
    if (!app.scheduleService.deleteTag(tag.id)) return;
    onClose();
  }

  return (
    <Modal title="编辑标签" onClose={onClose}>
      <div className="form-stack">
        <label className="field-label">名称
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} {...imeCompositionProps(ime)} onKeyDown={(event) => {
            if (event.key !== 'Enter' || holdImeEnter(event, ime)) return;
            event.preventDefault();
            save();
          }} />
        </label>
        <div className="form-actions">
          <DeleteButton onClick={remove} />
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </Modal>
  );
}
