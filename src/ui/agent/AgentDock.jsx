import React, { useLayoutEffect, useRef, useState } from 'react';
import { parseDateKey, todayKey } from '../../domain/shared/date-key.js';
import { useApp, useShell } from '../app/context.jsx';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../keyboard/ime-enter.js';

function tagName(tags, id) {
  if (!id) return '不挂标签';
  return tags.find((tag) => tag.id === id)?.name || '不挂标签';
}

function scrollPageBehind(event) {
  const main = document.querySelector('.app-frame .main');
  if (!main) return;
  main.scrollTop += event.deltaY;
}

export function AgentDock() {
  const app = useApp();
  useShell();
  const session = app.agentSession;
  const phase = app.pomodoroService.getSnapshot().phase;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const fadeRef = useRef(null);
  const sheetRef = useRef(null);
  const ime = useImeEnterGuard();
  const dockHidden = phase === 'work' || phase === 'break';

  useLayoutEffect(() => {
    const shell = document.querySelector('.app-shell');
    if (!shell) return undefined;
    if (dockHidden) {
      shell.style.setProperty('--agent-dock-reserve', '0px');
      return undefined;
    }
    const fade = fadeRef.current;
    const sheet = sheetRef.current;
    if (!fade || !sheet) return undefined;
    const apply = () => {
      const height = Math.ceil(fade.getBoundingClientRect().height + sheet.getBoundingClientRect().height);
      shell.style.setProperty('--agent-dock-reserve', `${height}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(fade);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [dockHidden]);

  if (dockHidden) return null;

  const refresh = () => setVersion((value) => value + 1);
  void version;
  const today = parseDateKey(todayKey());
  const todayLabel = today ? `今天 ${today.toLocaleDateString('zh-CN')}` : todayKey();
  const rows = session.rows();
  const tags = app.scheduleService.workspace.tags || [];
  const hasWindow = session.transcript.length > 0 || rows.length > 0 || busy || !!error;
  const expanded = panelOpen && hasWindow;

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    setBusy(true);
    setError('');
    setPanelOpen(true);
    const result = await session.submit(text);
    setBusy(false);
    if (!result.ok && result.error) setError(result.error);
    refresh();
  }

  async function confirm() {
    setBusy(true);
    setError('');
    const result = await session.confirm();
    setBusy(false);
    if (!result.ok) setError(result.error || '没有写入');
    refresh();
  }

  async function cancel() {
    await session.cancel();
    setError('');
    refresh();
  }

  return (
    <div className={expanded ? 'agent-dock is-open' : 'agent-dock'}>
      <div className="agent-fade" ref={fadeRef} aria-hidden="true">
        <div className="agent-fade-blur" />
      </div>
      {expanded ? (
        <div className="agent-panel">
          <button type="button" className="agent-close" aria-label="关闭" onClick={() => setPanelOpen(false)}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div className="agent-log" aria-live="polite">
            {session.transcript.map((item, index) => (
              <p key={`${item.role}-${index}`} className={item.role === 'user' ? 'agent-line agent-line-user' : 'agent-line'}>
                {item.text}
              </p>
            ))}
            {busy ? <p className="agent-line">正在安排…</p> : null}
          </div>
          {rows.length ? (
            <div className="agent-rows">
              {rows.map((row) => (
                <div key={row.id} className={row.removing ? 'agent-row is-removing' : 'agent-row'}>
                  <div className="agent-row-top">
                    <span className="agent-row-date">{row.date}</span>
                    {row.removing ? <span className="agent-row-flag">将从这一天拿下</span> : null}
                    <span className="agent-row-actions">
                      <button type="button" className="btn btn-quiet" onClick={() => { session.moveRow(row.id, -1).then(refresh); }} aria-label="上移">↑</button>
                      <button type="button" className="btn btn-quiet" onClick={() => { session.moveRow(row.id, 1).then(refresh); }} aria-label="下移">↓</button>
                      <button type="button" className="btn btn-quiet" onClick={() => { session.dropRow(row.id).then(refresh); }} aria-label="从方案拿掉">删</button>
                    </span>
                  </div>
                  {row.removing ? (
                    <div className="agent-row-title">{row.title}</div>
                  ) : (
                    <>
                      <input
                        className="field agent-title"
                        value={row.title}
                        aria-label="标题"
                        onChange={(event) => { session.editRow(row.id, { text: event.target.value }).then(refresh); }}
                      />
                      <div className="agent-row-fields">
                        <select
                          className="field"
                          aria-label="必做或选做"
                          value={row.list}
                          onChange={(event) => { session.editRow(row.id, { list: event.target.value }).then(refresh); }}
                        >
                          <option value="required">必做</option>
                          <option value="optional">选做</option>
                        </select>
                        <select
                          className="field"
                          aria-label="标签"
                          value={row.tagId}
                          onChange={(event) => { session.editRow(row.id, { tagId: event.target.value }).then(refresh); }}
                        >
                          <option value="">不挂标签</option>
                          {tags.map((tag) => (
                            <option key={tag.id} value={tag.id}>{tag.name}</option>
                          ))}
                        </select>
                        {row.writableDates.length > 1 ? (
                          <select
                            className="field"
                            aria-label="日期"
                            value={row.date}
                            onChange={(event) => { session.editRow(row.id, { date: event.target.value }).then(refresh); }}
                          >
                            {row.writableDates.map((key) => (
                              <option key={key} value={key}>{key}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                      <textarea
                        className="textarea agent-steps"
                        aria-label="子任务"
                        placeholder="步骤，一行一条"
                        defaultValue={(row.subtasks || []).join('\n')}
                        key={`${row.id}:${(row.subtasks || []).join('\n')}`}
                        onBlur={(event) => {
                          const subtasks = event.target.value.split('\n').map((item) => item.trim()).filter(Boolean);
                          session.editRow(row.id, { subtasks }).then(refresh);
                        }}
                      />
                      <div className="agent-row-meta">{tagName(tags, row.tagId)}</div>
                    </>
                  )}
                </div>
              ))}
              <div className="agent-confirm">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>确定</button>
                <button type="button" className="btn" disabled={busy} onClick={cancel}>放弃</button>
              </div>
            </div>
          ) : null}
          {error ? <p className="agent-error">{error}</p> : null}
        </div>
      ) : null}
      <div className="agent-sheet" ref={sheetRef} onWheel={scrollPageBehind}>
        <form
          className="agent-bar"
          {...imeCompositionProps(ime)}
          onKeyDown={(event) => { holdImeEnter(event, ime); }}
          onSubmit={(event) => {
            event.preventDefault();
            if (ime.shouldIgnoreSubmit()) return;
            send();
          }}
        >
          <span className="agent-date">{todayLabel}</span>
          <input
            className="field agent-input"
            value={draft}
            placeholder="安排今天，或直接说要做的事"
            aria-label="跟日程代理说"
            onFocus={() => { if (hasWindow) setPanelOpen(true); }}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="agent-send" disabled={busy || !draft.trim()} aria-label="发送">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 19V7M7 11l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
