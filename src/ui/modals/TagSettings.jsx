import React, { useState } from 'react';
import { normalizeTagIds } from '../../domain/schedule/daily-task.js';
import { displayTagColor } from '../../domain/schedule/fixed-tags.js';
import { useApp, useShell } from '../app/context.jsx';
import { Symbol } from '../library/index.js';
import { TagCreateModal, TagEditModal } from './TagDialogs.jsx';

/**
 * @param {Array<{ tagIds?: string[] }>|null|undefined} tasks
 * @param {string} id
 */
function tasksUsing(tasks, id) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => normalizeTagIds(task).includes(id)).length;
}

export function TagSettings() {
  const app = useApp();
  useShell();
  const tags = app.scheduleService.workspace.tags || [];
  const tasks = app.scheduleService.data?.tasks;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const editing = tags.find((tag) => tag.id === editingId) || null;

  return (
    <>
      <section className="settings-card">
        <header className="settings-card-head">
          <div>
            <h3 className="settings-card-title">标签</h3>
            <p className="settings-card-desc">全局一份。任务页只显示当天挂着任务的，以及钉住的。</p>
          </div>
          <button type="button" className="settings-btn" onClick={() => setAdding(true)}>新建</button>
        </header>
        {tags.length === 0 ? <p className="settings-empty">还没有标签。</p> : tags.map((tag) => {
          const count = tasksUsing(tasks, tag.id);
          const color = displayTagColor(tag) || '#8E8E93';
          return (
            <div key={tag.id} className="settings-list-row">
              <button type="button" className="settings-tag-open" onClick={() => setEditingId(tag.id)}>
                <span className="settings-tag-title">
                  <span className="settings-tag-swatch" style={{ background: color }} />
                  <span>{tag.name}</span>
                </span>
                <span className="settings-list-meta">
                  {count} 条任务{tag.description ? ` · ${tag.description}` : ''}
                </span>
              </button>
              <div className="settings-list-actions">
                <button
                  type="button"
                  className={tag.pinned ? 'settings-icon-btn is-on' : 'settings-icon-btn'}
                  aria-label={tag.pinned ? `取消钉住 ${tag.name}` : `钉住 ${tag.name}`}
                  aria-pressed={tag.pinned === true}
                  title={tag.pinned ? '取消钉住' : '钉住'}
                  onClick={() => app.scheduleService.toggleTagPin(tag.id)}
                >
                  <Symbol name="pin" size={16} />
                </button>
                <button
                  type="button"
                  className="settings-icon-btn"
                  aria-label={`编辑 ${tag.name}`}
                  title="编辑"
                  onClick={() => setEditingId(tag.id)}
                >
                  <Symbol name="edit" size={16} />
                </button>
                <button
                  type="button"
                  className="settings-icon-btn"
                  aria-label={`删除 ${tag.name}`}
                  title="删除"
                  onClick={() => {
                    if (editingId === tag.id) setEditingId(null);
                    app.scheduleService.deleteTag(tag.id);
                  }}
                >
                  <Symbol name="delete" size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </section>
      <TagCreateModal open={adding} onClose={() => setAdding(false)} />
      <TagEditModal tag={editing} open={!!editing} onClose={() => setEditingId(null)} />
    </>
  );
}
