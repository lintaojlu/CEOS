import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';

const OPTIONS = [
  ['ready', '可捡起'],
  ['completed', '已完成'],
  ['waiting', '等待中']
];

export const DEFAULT_IDEA_FILTER = { ready: true, completed: false, waiting: true };

export function IdeaStatusFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const changed = value.ready !== DEFAULT_IDEA_FILTER.ready
    || value.completed !== DEFAULT_IDEA_FILTER.completed
    || value.waiting !== DEFAULT_IDEA_FILTER.waiting;

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
        <Icon name="filter" />
      </button>
      {open ? (
        <div className="filter-panel" role="group" aria-label="显示哪些任务">
          {OPTIONS.map(([id, label]) => (
            <label key={id} className="filter-option">
              <input
                type="checkbox"
                className="checkbox"
                checked={!!value[id]}
                onChange={() => onChange({ ...value, [id]: !value[id] })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </span>
  );
}
