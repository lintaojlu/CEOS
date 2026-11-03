import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { tagPillStyle } from '../../../domain/schedule/fixed-tags.js';
import { DeleteButton, Modal, Symbol } from '../../library/index.js';
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
      <div className="tag-board">
        {tags.map((tag) => (
          <span key={tag.id} className={tag.pinned ? 'tag-pill-wrap is-pinned' : 'tag-pill-wrap'}>
            <button
              type="button"
              className={selected.has(tag.id) ? 'tag-pill is-on' : 'tag-pill'}
              style={tagPillStyle(tag)}
              title={tag.description || undefined}
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
        <button
          type="button"
          className="tag-pill tag-pill-add"
          aria-label="新建标签"
          title="新建标签"
          onClick={() => setAdding(true)}
        >
          <Symbol name="plus" size={14} />
        </button>
      </div>
      <TagCreateModal open={adding} onClose={() => setAdding(false)} />
      <TagEditModal tag={editing} open={!!editing} onClose={() => setEditingId(null)} />
    </section>
  );
}

function TagCreateModal({ open, onClose }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
  }, [open]);

  function save(event) {
    event.preventDefault();
    if (ime.shouldIgnoreSubmit()) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!app.scheduleService.addTag(trimmed, description)) {
      window.alert('名称无效，或已有同名标签');
      return;
    }
    onClose();
  }

  return (
    <Modal title="新建标签" open={open} onClose={onClose}>
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
        <label className="field-label">描述
          <textarea
            className="field textarea"
            rows={3}
            value={description}
            placeholder="什么情况下任务属于这个标签"
            onChange={(event) => setDescription(event.target.value)}
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

function TagEditModal({ tag, open, onClose }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const kept = useRef(tag);
  if (tag) kept.current = tag;
  const current = tag || kept.current;
  const [name, setName] = useState(current?.name || '');
  const [description, setDescription] = useState(current?.description || '');

  useEffect(() => {
    if (!tag) return;
    setName(tag.name);
    setDescription(tag.description || '');
  }, [tag]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setGenerateError('');
    try {
      const next = await app.taskTagService.generateDescription(current.id, { name, description });
      setDescription(next);
    } catch (error) {
      setGenerateError(error?.message || '没有得到可用的描述');
    } finally {
      setGenerating(false);
    }
  }

  function save() {
    if (!current || !app.scheduleService.renameTag(current.id, name, description)) {
      window.alert('名称无效，或已有同名标签');
      return;
    }
    onClose();
  }

  function remove() {
    if (!current || !app.scheduleService.deleteTag(current.id)) return;
    onClose();
  }

  return (
    <Modal title="编辑标签" open={open && !!current} onClose={onClose}>
      <div className="form-stack">
        <label className="field-label">名称
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} {...imeCompositionProps(ime)} onKeyDown={(event) => {
            if (event.key !== 'Enter' || holdImeEnter(event, ime)) return;
            event.preventDefault();
            save();
          }} />
        </label>
        <div>
          <div className="tag-description-head">
            <span className="field-label">描述</span>
            <button type="button" className="btn btn-quiet" disabled={generating} onClick={generate}>
              {generating ? '正在生成…' : '生成描述'}
            </button>
          </div>
          <textarea
            className="field textarea"
            rows={3}
            value={description}
            aria-label="描述"
            placeholder="什么情况下任务属于这个标签"
            onChange={(event) => setDescription(event.target.value)}
          />
          {generateError ? <p className="task-break-error">{generateError}</p> : null}
        </div>
        <div className="form-actions">
          <DeleteButton onClick={remove} />
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </Modal>
  );
}
