import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../library/index.js';

const OPTIONS = [
  ['open', '未完成'],
  ['all', '全部'],
  ['done', '已完成']
];

export const DEFAULT_IDEA_FILTER = 'open';

export function IdeaStatusFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const changed = value !== DEFAULT_IDEA_FILTER;

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <span className="filter-menu" ref={rootRef}>
      <button
        type="button"
        className={open || changed ? 'btn btn-icon is-on' : 'btn btn-quiet btn-icon'}
        aria-label="筛选"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="filter" size={18} />
      </button>
      {open ? (
        <div className="filter-panel" role="group" aria-label="显示哪些灵感">
          {OPTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={value === id ? 'filter-option is-selected' : 'filter-option'}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
