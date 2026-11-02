import React, { useState } from 'react';
import { useApp, useShell } from '../app/context.jsx';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../keyboard/ime-enter.js';

export function AgentTopBar() {
  const app = useApp();
  useShell();
  const ime = useImeEnterGuard();
  const threads = app.agentThreads;
  const view = threads.view();
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  function startRename() {
    setTitleDraft(view.title || '');
    setEditing(true);
  }

  async function saveTitle() {
    setEditing(false);
    const next = titleDraft.trim();
    if (!next || next === view.title) return;
    await threads.rename(next);
  }

  const title = view.title || '新对话';

  return (
    <div className="topbar-heading is-thread">
      <h1 className="topbar-title">
        {editing ? (
          <input
            className="topbar-title-input"
            aria-label="对话标题"
            value={titleDraft}
            autoFocus
            {...imeCompositionProps(ime)}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || holdImeEnter(event, ime)) return;
              event.currentTarget.blur();
            }}
          />
        ) : (
          <button type="button" className="topbar-title-button" onClick={startRename}>
            {title}
          </button>
        )}
      </h1>
    </div>
  );
}
