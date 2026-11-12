import React, { useRef, useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { tagPillStyle } from '../../../domain/schedule/fixed-tags.js';
import { Symbol } from '../../library/index.js';
import { TagCreateModal, TagEditModal } from '../../modals/TagDialogs.jsx';

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
