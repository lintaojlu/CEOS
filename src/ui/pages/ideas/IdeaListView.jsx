import React, { useState } from 'react';
import { Events } from '../../../application/event-bus.js';
import { ideaPreview, ideaTitle } from '../../../domain/ideas/idea-document.js';
import { useApp } from '../../app/context.jsx';
import { flyTextToComposer } from '../../agent/fly-to-composer.js';
import { ContextMenu } from '../../library/index.js';
import { ideaListDate } from './idea-list-date.js';

export function IdeaListView({ onSelect, selectedId }) {
  const app = useApp();
  const { ready, waiting } = app.ideaInboxService.partition();
  const byCreated = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const visible = [...ready, ...waiting].sort(byCreated);
  const [menu, setMenu] = useState(null);
  const [breakingId, setBreakingId] = useState('');
  const [error, setError] = useState(null);

  async function breakdown(id) {
    if (breakingId) return;
    setBreakingId(id);
    setError(null);
    try {
      const draft = app.ideaBreakdownService.prepareComposer(id);
      const from = document.getElementById(`idea-row-${id}`)?.getBoundingClientRect();
      if (from) await flyTextToComposer(from, draft.flyText);
      app.eventBus.emit(Events.AGENT_COMPOSER_DRAFT, draft);
    } catch (err) {
      setError({ id, message: err?.message || '拆解失败' });
    } finally {
      setBreakingId('');
    }
  }

  function renderIdea(idea) {
    const title = ideaTitle(idea) || '未命名';
    const preview = ideaPreview(idea.body);
    const selected = idea.id === selectedId;
    const breaking = breakingId === idea.id;
    return (
      <div key={idea.id} className="idea-row-block">
        <button
          type="button"
          id={`idea-row-${idea.id}`}
          className={selected ? 'idea-row is-selected' : 'idea-row'}
          aria-current={selected ? 'true' : undefined}
          onClick={() => onSelect(idea.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ id: idea.id, x: event.clientX, y: event.clientY });
          }}
        >
          <span className="idea-row-head">
            <span className="idea-row-title">{title}</span>
            {breaking ? <span className="task-break-spin" role="status" aria-label="正在拆解" /> : null}
          </span>
          <span className="idea-row-meta">
            <span className="idea-row-date">{ideaListDate(idea.createdAt)}</span>
            {preview ? <span className="idea-row-preview">{preview}</span> : null}
          </span>
        </button>
        {error?.id === idea.id ? <p className="idea-row-note">{error.message}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {visible.length === 0 ? (
        <p className="empty">暂无灵感。</p>
      ) : visible.map((idea) => renderIdea(idea))}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              id: 'archive',
              label: '归档',
              onSelect: () => app.ideaInboxService.setArchived(menu.id, true)
            },
            {
              id: 'breakdown',
              label: '拆解',
              disabled: !!breakingId,
              onSelect: () => { void breakdown(menu.id); }
            }
          ]}
        />
      ) : null}
    </div>
  );
}
