import React from 'react';

export function Checkbox({ checked, onChange }) {
  return (
    <input
      type="checkbox"
      className="checkbox"
      checked={!!checked}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        onChange(event.target.checked);
      }}
    />
  );
}
