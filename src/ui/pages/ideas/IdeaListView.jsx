import React from 'react';
import { useApp } from '../../app/context.jsx';
import { ideaTitle } from '../../../domain/ideas/idea-document.js';
import { ideaListDate } from './idea-list-date.js';

export function IdeaListView({ onSelect, selectedId, filter }) {
  const app = useApp();
  const { ready, completed } = app.ideaInboxService.partition();
  const byCreated = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const visible = (filter === 'done' ? completed : filter === 'all' ? [...ready, ...completed] : ready)
    .slice()
    .sort(byCreated);

  function renderIdea(idea) {
    const title = ideaTitle(idea) || '未命名';
    const selected = idea.id === selectedId;
    return (
      <button
        key={idea.id}
        type="button"
        id={`idea-row-${idea.id}`}
        className={['idea-row', selected ? 'is-selected' : '', idea.completed ? 'is-done' : ''].filter(Boolean).join(' ')}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(idea.id)}
      >
        <span className="idea-row-title">{title}</span>
        <span className="idea-row-date">{ideaListDate(idea.createdAt)}</span>
      </button>
    );
  }

  const total = ready.length + completed.length;
  return (
    <div>
      {visible.length === 0 ? (
        <p className="empty">{total === 0 ? '暂无灵感。' : '当前筛选下没有灵感。'}</p>
      ) : visible.map((idea) => renderIdea(idea))}
    </div>
  );
}
