import React, { useState } from 'react';
import { useApp, useShell } from '../app/context.jsx';
import { DeleteButton } from '../library/index.js';
import { AgentTranscript } from './AgentTranscript.jsx';

export function AgentPage() {
  const app = useApp();
  const shell = useShell();
  void shell.revision;
  const threads = app.agentThreads;
  const view = threads.view();
  const tags = app.scheduleService.workspace.tags || [];
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="agent-page">
      <div className="agent-page-head">
        {editing ? (
          <input
            className="field agent-page-title-input"
            aria-label="对话标题"
            value={titleDraft}
            autoFocus
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        ) : (
          <button type="button" className="agent-page-title" onClick={startRename}>
            {view.title || '新对话'}
          </button>
        )}
        <button type="button" className="btn btn-quiet" disabled={view.busy} onClick={() => { setError(''); threads.beginNew(); setHistoryOpen(false); }}>
          新对话
        </button>
        <button type="button" className="btn btn-quiet" disabled={view.busy} onClick={() => setHistoryOpen((value) => !value)}>
          历史
        </button>
        {historyOpen ? (
          <div className="agent-history">
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
      <div className="agent-page-log">
        <div className="agent-page-column">
        <AgentTranscript
          layout="page"
          messages={view.messages}
          rows={view.rows}
          tags={tags}
          busy={view.busy}
          onEdit={(id, patch) => { threads.editRow(id, patch); }}
          onDrop={(id) => { threads.dropRow(id); }}
          onMove={(id, direction) => { threads.moveRow(id, direction); }}
          onConfirm={async () => {
            setError('');
            const result = await threads.confirm();
            if (!result.ok) setError(result.error || '没有写入');
          }}
          onCancel={async () => {
            setError('');
            await threads.cancel();
          }}
        />
        {error ? <p className="agent-error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
