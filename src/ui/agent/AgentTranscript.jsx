import React, { useState } from 'react';
import { DeleteButton, Markdown, Symbol } from '../library/index.js';

function tagName(tags, id) {
  if (!id) return '不挂标签';
  return tags.find((tag) => tag.id === id)?.name || '不挂标签';
}

function preview(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}

/**
 * @param {object} props
 * @param {any[]} props.messages
 * @param {any[]} props.rows
 * @param {any[]} props.tags
 * @param {boolean} props.busy
 * @param {(id: string, patch: Record<string, any>) => void} props.onEdit
 * @param {(id: string) => void} props.onDrop
 * @param {(id: string, direction: -1 | 1) => void} props.onMove
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {'dock' | 'page'} [props.layout]
 */
export function AgentTranscript({ messages, rows, tags, busy, onEdit, onDrop, onMove, onConfirm, onCancel, layout = 'dock' }) {
  const page = layout === 'page';
  const lastAssistant = messages.findLastIndex((item) => item.role === 'assistant');
  return (
    <div className={page ? 'agent-log is-page' : 'agent-log'} aria-live="polite">
      {messages.map((item, index) => (
        item.role === 'user' ? (
          <div key={`user-${index}`} className={page ? 'agent-turn agent-turn-user' : 'agent-turn'}>
            {item.mentions?.length ? (
              <div className="agent-chips">
                {item.mentions.map((mention) => (
                  <span key={`${mention.kind}:${mention.id}`} className="agent-chip is-static">{mention.label}</span>
                ))}
              </div>
            ) : null}
            {page
              ? <p className="agent-bubble">{item.text}</p>
              : <p className="agent-line agent-line-user">{item.text}</p>}
          </div>
        ) : (
          <AssistantTurn
            key={`assistant-${index}`}
            message={item}
            layout={layout}
            pending={busy && index === lastAssistant && !item.text}
          />
        )
      ))}
      {busy && lastAssistant === -1 ? (
        page
          ? (
            <div className="agent-turn agent-turn-assistant">
              <Identity />
              <p className="agent-status">正在安排…</p>
            </div>
          )
          : <p className="agent-line">正在安排…</p>
      ) : null}
      {rows.length ? (
        <div className="agent-rows">
          {rows.map((row) => (
            <div key={row.id} className={row.removing ? 'agent-row is-removing' : 'agent-row'}>
              <div className="agent-row-top">
                <span className="agent-row-date">{row.date}</span>
                {row.removing ? <span className="agent-row-flag">将从这一天拿下</span> : null}
                <span className="agent-row-actions">
                  <button type="button" className="btn btn-quiet" onClick={() => onMove(row.id, -1)} aria-label="上移">↑</button>
                  <button type="button" className="btn btn-quiet" onClick={() => onMove(row.id, 1)} aria-label="下移">↓</button>
                  <DeleteButton label="从方案拿掉" onClick={() => onDrop(row.id)} />
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
                    onChange={(event) => onEdit(row.id, { text: event.target.value })}
                  />
                  <div className="agent-row-fields">
                    <select
                      className="field"
                      aria-label="必做或选做"
                      value={row.list}
                      onChange={(event) => onEdit(row.id, { list: event.target.value })}
                    >
                      <option value="required">必做</option>
                      <option value="optional">选做</option>
                    </select>
                    <select
                      className="field"
                      aria-label="标签"
                      value={row.tagId}
                      onChange={(event) => onEdit(row.id, { tagId: event.target.value })}
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
                        onChange={(event) => onEdit(row.id, { date: event.target.value })}
                      >
                        {row.writableDates.map((key) => (
                          <option key={key} value={key}>{key}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <textarea
                    className="textarea agent-steps"
                    aria-label="说明"
                    placeholder="说明，一行一条"
                    defaultValue={(row.subtasks || []).join('\n')}
                    key={`${row.id}:${(row.subtasks || []).join('\n')}`}
                    onBlur={(event) => {
                      const subtasks = event.target.value.split('\n').map((line) => line.trim()).filter(Boolean);
                      onEdit(row.id, { subtasks });
                    }}
                  />
                  <div className="agent-row-meta">{tagName(tags, row.tagId)}</div>
                </>
              )}
            </div>
          ))}
          <div className="agent-confirm">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>确定</button>
            <button type="button" className="btn" disabled={busy} onClick={onCancel}>放弃</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Identity() {
  return (
    <div className="agent-identity">
      <span className="agent-avatar"><Symbol name="agent" size={15} /></span>
      <span>Agent</span>
    </div>
  );
}

function AssistantTurn({ message, layout, pending }) {
  const page = layout === 'page';
  const [open, setOpen] = useState(false);
  const [thinkOpen, setThinkOpen] = useState(false);
  const events = message.events || [];
  const reasoning = events.filter((event) => event.kind === 'reasoning');
  const steps = events.filter((event) => event.kind !== 'reasoning');
  const process = events.length ? (
    <div className="agent-process">
      <button type="button" className={page ? 'agent-status' : 'agent-process-toggle'} onClick={() => setOpen((value) => !value)}>
        过程
        <span aria-hidden="true">{open ? '⌄' : '›'}</span>
      </button>
      {open ? (
        <div className="agent-process-body">
          {reasoning.length ? (
            <div>
              <button type="button" className="agent-process-toggle" onClick={() => setThinkOpen((value) => !value)}>
                深度思考
              </button>
              {thinkOpen ? reasoning.map((event, index) => (
                <p key={`think-${index}`} className="agent-process-line">{event.text}</p>
              )) : null}
            </div>
          ) : null}
          {steps.map((event, index) => (
            <p key={`step-${index}`} className="agent-process-line">
              {event.kind === 'tool_call'
                ? `调用 ${event.name} ${preview(event.arguments)}`
                : `${event.ok ? '结果' : '失败'} ${event.name} ${preview(event.payload)}`}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;
  const body = message.text
    ? (page ? <div className="agent-answer"><Markdown text={message.text} /></div> : <p className="agent-line">{message.text}</p>)
    : null;
  return (
    <div className={page ? 'agent-turn agent-turn-assistant' : 'agent-turn'}>
      {page ? <Identity /> : null}
      {page ? process : null}
      {pending ? <p className="agent-status">正在安排…</p> : null}
      {body}
      {page ? null : process}
    </div>
  );
}
