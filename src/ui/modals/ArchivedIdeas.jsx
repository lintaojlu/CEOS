import React, { useEffect, useState } from 'react';
import { ideaTitle } from '../../domain/ideas/idea-document.js';
import { useApp, useShell } from '../app/context.jsx';
import { Symbol } from '../library/index.js';

/** @param {number} value */
function stamp(value) {
  const date = new Date(Number(value) || 0);
  if (!value || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ArchivedIdeas() {
  const app = useApp();
  useShell();
  const [armed, setArmed] = useState('');
  const { archived } = app.ideaInboxService.partition();

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(''), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (!archived.length) {
    return (
      <div className="settings-card">
        <p className="settings-empty">没有归档的灵感。在灵感列表里右键「归档」，或拆解完成后会收到这里。</p>
      </div>
    );
  }

  return (
    <div className="settings-card settings-list">
      {archived.map((idea) => {
        const title = ideaTitle(idea) || app.ideaInboxService.boardLabel(idea.id) || '未命名';
        const waiting = armed === idea.id;
        return (
          <div key={idea.id} className="settings-list-row">
            <div className="settings-list-text">
              <div className="settings-list-title">{title}</div>
              <div className="settings-list-meta">{stamp(idea.archivedAt || idea.createdAt)}</div>
            </div>
            <div className="settings-list-actions">
              <button
                type="button"
                className={waiting ? 'settings-icon-btn is-danger' : 'settings-icon-btn'}
                aria-label={waiting ? `确认删除 ${title}` : `删除 ${title}`}
                title={waiting ? '再点一次删除，正文和画板都会删掉' : '删除'}
                onClick={() => {
                  if (!waiting) {
                    setArmed(idea.id);
                    return;
                  }
                  setArmed('');
                  app.ideaInboxService.delete(idea.id);
                }}
              >
                <Symbol name="delete" size={18} />
              </button>
              <button
                type="button"
                className="settings-icon-btn"
                aria-label={`恢复 ${title}`}
                title="恢复到灵感页"
                onClick={() => app.ideaInboxService.setArchived(idea.id, false)}
              >
                <Symbol name="unarchive" size={18} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
