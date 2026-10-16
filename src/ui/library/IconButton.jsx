import React from 'react';
import { Symbol } from './symbols.jsx';

/**
 * 只有一个符号的按钮。label 读给辅助技术，画面上不写字。
 * @param {{ name: string, label: string, onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void, danger?: boolean, size?: number, className?: string }} props
 */
export function IconButton({ name, label, onClick, danger = false, size = 16, className = '' }) {
  return (
    <button
      type="button"
      className={`icon-button${danger ? ' is-danger' : ''} ${className}`.trim()}
      aria-label={label}
      onClick={onClick}
    >
      <Symbol name={name} size={size} />
    </button>
  );
}

/** 各处删除都用这一颗。 */
export function DeleteButton({ label = '删除', onClick, className = '', size = 16 }) {
  return <IconButton name="delete" label={label} danger onClick={onClick} className={className} size={size} />;
}
