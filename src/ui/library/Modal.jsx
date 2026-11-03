import React, { useId } from 'react';
import { IconButton } from './IconButton.jsx';
import { Overlay } from './Overlay.jsx';

export function Modal({ title, children, onClose, wide = false, open = true }) {
  const titleId = useId();
  return (
    <Overlay open={open} wide={wide} onClose={onClose} label={title}>
      <div className="card-head">
        <h2 id={titleId} className="card-title">{title}</h2>
        <IconButton name="close" label="关闭" onClick={onClose} />
      </div>
      {children}
    </Overlay>
  );
}
