import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/context.jsx';
import { DeleteButton, Modal } from '../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../keyboard/ime-enter.js';

export function TagCreateModal({ open, onClose }) {
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

export function TagEditModal({ tag, open, onClose }) {
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
