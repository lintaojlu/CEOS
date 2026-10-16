import React from 'react';
import { IconButton } from './IconButton.jsx';

export function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className={`card modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="card-head">
          <h2 className="card-title">{title}</h2>
          <IconButton name="close" label="关闭" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
