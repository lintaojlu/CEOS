import React, { useEffect, useRef, useState } from 'react';
import { useApp, useShell } from '../app/context.jsx';
import { DeleteButton, IconButton } from '../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../keyboard/ime-enter.js';

export function AgentTopBar() {
  const app = useApp();
  useShell();
  const ime = useImeEnterGuard();
  const threads = app.agentThreads;
  const view = threads.view();
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef(null);

  useEffect(() => {
    if (!historyOpen) return undefined;
    function onPointerDown(event) {
      if (historyRef.current?.contains(event.target)) return;
      setHistoryOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [historyOpen]);

  function startRename() {
    setTitleDraft(view.title || '');
    setEditing(true);
    setHistoryOpen(false);
  }

  async function saveTitle() {
    setEditing(false);
    const next = titleDraft.trim();
    if (!next || next === view.title) return;
    await threads.rename(next);
  }

  function beginNew() {
    threads.beginNew();
    setHistoryOpen(false);
  }

  const title = view.title || '新对话';

  return (
    <>
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
      <div className="topbar-actions" ref={historyRef}>
        <div className="topbar-icon-row">
          <IconButton name="plus" label="新对话" title="新对话" size={18} disabled={view.busy} onClick={beginNew} />
          <IconButton
            name="history"
            label="历史"
            title="历史"
            size={18}
            disabled={view.busy}
            onClick={() => setHistoryOpen((open) => !open)}
          />
        </div>
        {historyOpen ? (
          <div className="agent-history" data-tauri-drag-region="false">
            {view.threads.length ? view.threads.map((thread) => (
              <div key={thread.id} className={thread.id === view.id ? 'agent-history-row is-current' : 'agent-history-row'}>
                <button
                  type="button"
                  className="agent-history-open"
                  onClick={() => { threads.open(thread.id).then(() => setHistoryOpen(false)); }}
                >
                  {thread.title || '新对话'}
                </button>
                <DeleteButton label="删除对话" onClick={() => { threads.remove(thread.id); }} />
              </div>
            )) : <p className="agent-menu-empty">还没有对话</p>}
          </div>
        ) : null}
      </div>
    </>
  );
}
