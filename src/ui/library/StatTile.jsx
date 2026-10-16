import React from 'react';

export function StatTile({ value, caption, text }) {
  return (
    <article className="stat-tile">
      <div className="stat-value">{value}</div>
      <div className="stat-caption">{caption}</div>
      {text ? <p className="stat-text">{text}</p> : null}
    </article>
  );
}
