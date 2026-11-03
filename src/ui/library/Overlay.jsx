import React, { useEffect, useRef } from 'react';

/**
 * 居中弹窗。打开时遮罩变暗、面板轻轻上移；关掉立刻卸掉。
 * @param {{
 *   open?: boolean,
 *   onClose: () => void,
 *   wide?: boolean,
 *   label?: string,
 *   className?: string,
 *   children: React.ReactNode
 * }} props
 */
export function Overlay({
  open = true,
  onClose,
  wide = false,
  label,
  className = '',
  children
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return undefined;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  const classes = ['overlay', 'overlay-modal'];
  if (wide) classes.push('overlay-wide');
  if (className) classes.push(className);

  return (
    <dialog
      ref={ref}
      className={classes.join(' ')}
      aria-label={label}
      data-tauri-drag-region="false"
      onCancel={(event) => {
        event.preventDefault();
        if (document.querySelector('.context-menu')) return;
        onClose();
      }}
      onPointerDown={(event) => {
        if (event.target !== ref.current) return;
        onClose();
      }}
    >
      <div className="overlay-panel">{children}</div>
    </dialog>
  );
}
