import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 指针旁的选项列表。点外面或按 Esc 关闭。
 * @param {{
 *   x: number,
 *   y: number,
 *   onClose: () => void,
 *   items: Array<{ id: string, label: string, disabled?: boolean, onSelect?: () => void }>
 * }} props
 */
export function ContextMenu({ x, y, onClose, items }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    setPos((current) => (current.left === left && current.top === top ? current : { left, top }));
  }, [x, y]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    function onPointer(event) {
      if (ref.current && ref.current.contains(event.target)) return;
      onClose();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="context-menu-item"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect?.();
            onClose();
          }}
        >{item.label}</button>
      ))}
    </div>,
    document.body
  );
}
