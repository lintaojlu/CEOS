import React, { useRef, useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { isFixedTag, tagPillStyle } from '../../../domain/schedule/fixed-tags.js';
import { DeleteButton, Icon, Modal } from '../../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../../keyboard/ime-enter.js';

export function TagsCard({ tags = [], selectedIds, onToggle }) {
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
        <button type="button" className="tag-add" onClick={() => setAdding(true)} aria-label="新建标签">
          <Icon name="plus" />
        </button>
      </div>
      <div className="tag-board">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={selected.has(tag.id) ? 'tag-pill is-on' : 'tag-pill'}
            style={tagPillStyle(tag)}
            onClick={() => clickTag(tag.id)}
            onDoubleClick={isFixedTag(tag) ? undefined : () => editTag(tag.id)}
          >{tag.name}</button>
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
  const [confirming, setConfirming] = useState(false);

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
        {confirming ? (
          <p className="tag-delete-note">删除标签「{tag.name}」？任务会保留，只是去掉这个标记。</p>
        ) : null}
        <div className="form-actions">
          {confirming ? (
            <DeleteButton label="确认删除" onClick={remove} />
          ) : (
            <DeleteButton onClick={() => setConfirming(true)} />
          )}
          <button type="button" className="btn" onClick={onClose}>取消</button>
          {confirming ? null : <button type="button" className="btn btn-primary" onClick={save}>保存</button>}
        </div>
      </div>
    </Modal>
  );
}
