import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LlmRequestError } from '../../application/llm-service.js';
import { DEFAULT_JEV_BASE_URL } from '../../infrastructure/storage/llm-settings-repository.js';
import { useApp, useShell } from '../app/context.jsx';
import { Modal, Symbol } from '../library/index.js';
import { groupModelIds } from './model-list.js';
import { readSecret, secretsToSave } from './secret-field.js';

const MODEL_ROWS = [
  { id: 'model', label: '默认', placeholder: '选择或填写模型 ID' },
  { id: 'agentModel', label: 'Agent', placeholder: '同默认' },
  { id: 'breakdownModel', label: '拆解', placeholder: '同默认' },
  { id: 'tagModel', label: '分类', placeholder: '同默认' },
  { id: 'standardizeModel', label: '标准化', placeholder: '同默认' }
];

const EMPTY_MODELS = {
  model: '',
  agentModel: '',
  breakdownModel: '',
  tagModel: '',
  standardizeModel: ''
};

export function SettingsModal() {
  const app = useApp();
  const shell = useShell();
  const saved = app.llmService.load();
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl);
  const [fullUrl, setFullUrl] = useState(saved.fullUrl);
  const [modelsBySlot, setModelsBySlot] = useState(() => slotValues(saved));
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [modelIds, setModelIds] = useState([]);
  const [openPicker, setOpenPicker] = useState('');
  const [jevApiKey, setJevApiKey] = useState(saved.jevApiKey || '');
  const [showJevKey, setShowJevKey] = useState(false);
  const [jevBaseUrl, setJevBaseUrl] = useState(saved.jevBaseUrl || DEFAULT_JEV_BASE_URL);
  const [jevModel, setJevModel] = useState(saved.jevModel || '');
  const [jevModelIds, setJevModelIds] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const wasOpen = useRef(false);
  const apiKeyRef = useRef(null);
  const jevKeyRef = useRef(null);
  const pressed = useRef(null);

  useEffect(() => {
    const opening = shell.settingsOpen && !wasOpen.current;
    wasOpen.current = shell.settingsOpen;
    if (!opening) return;
    pressed.current = null;
    const next = app.llmService.load();
    setBaseUrl(next.baseUrl);
    setFullUrl(next.fullUrl);
    setModelsBySlot(slotValues(next));
    setApiKey(next.apiKey);
    setShowKey(false);
    setModelIds([]);
    setOpenPicker('');
    setJevApiKey(next.jevApiKey || '');
    setShowJevKey(false);
    setJevBaseUrl(next.jevBaseUrl || DEFAULT_JEV_BASE_URL);
    setJevModel(next.jevModel || '');
    setJevModelIds([]);
    setStatus('');
  }, [shell.settingsOpen, app]);

  if (!shell.settingsOpen) return null;

  function liveSecrets() {
    return secretsToSave(pressed.current, {
      apiKey: readSecret(apiKeyRef.current, apiKey),
      jevApiKey: readSecret(jevKeyRef.current, jevApiKey)
    });
  }

  function draft() {
    const secrets = liveSecrets();
    return { baseUrl, fullUrl, ...modelsBySlot, jevBaseUrl, jevModel, ...secrets };
  }

  function holdSecrets() {
    pressed.current = {
      apiKey: readSecret(apiKeyRef.current, apiKey),
      jevApiKey: readSecret(jevKeyRef.current, jevApiKey)
    };
    const clear = () => {
      window.removeEventListener('mouseup', clear, true);
      setTimeout(() => {
        pressed.current = null;
      }, 0);
    };
    window.addEventListener('mouseup', clear, true);
  }

  function setSlot(id, value) {
    setModelsBySlot((current) => ({ ...current, [id]: value }));
  }

  function persist() {
    app.llmService.save(draft());
    pressed.current = null;
    shell.closeSettings();
  }

  async function test() {
    setBusy(true);
    setStatus('正在测试连接…');
    app.llmService.save(draft());
    try {
      const text = await app.llmService.testConnection();
      setStatus(`连接成功：${text.slice(0, 80)}`);
    } catch (error) {
      const message = error instanceof LlmRequestError ? error.message : (error?.message || '连接失败');
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshModels() {
    setBusy(true);
    setStatus('正在读取模型列表…');
    try {
      const ids = await app.llmService.listModels(draft());
      setModelIds(ids);
      if (ids.length === 0) {
        setStatus('这个地址没有返回模型。可以直接填写模型 ID。');
      } else {
        setStatus(`已读取 ${ids.length} 个模型。`);
      }
    } catch (error) {
      const message = error instanceof LlmRequestError ? error.message : (error?.message || '读取模型失败');
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshJevModels() {
    setBusy(true);
    setStatus('正在读取 JEV 模型列表…');
    try {
      const ids = await app.jevService.listModels(draft());
      setJevModelIds(ids);
      if (ids.length === 0) {
        setStatus('这个地址没有返回 JEV 模型。可以直接填写模型 ID。');
      } else {
        setStatus(`已读取 ${ids.length} 个 JEV 模型。`);
      }
    } catch (error) {
      const message = error instanceof LlmRequestError ? error.message : (error?.message || '读取模型失败');
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="设置" onClose={shell.closeSettings} wide>
      <div className="form-stack">
        <label className="settings-label">API Key
          <span className="field-affix">
            <input
              ref={apiKeyRef}
              className={showKey ? 'field' : 'field is-masked'}
              type="text"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <button
              type="button"
              className="field-affix-btn"
              aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
              onClick={() => setShowKey((value) => !value)}
            >
              <Symbol name={showKey ? 'eye-off' : 'eye'} size={16} />
            </button>
          </span>
        </label>

        <div>
          <div className="settings-label-row">
            <span className="settings-label">API 请求地址</span>
            <button type="button" className="btn btn-quiet" onMouseDown={holdSecrets} onClick={test} disabled={busy}>测试连接</button>
          </div>
          <input
            className="field"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.openai.com/v1"
            spellCheck="false"
          />
        </div>

        <p className="endpoint-hint">
          <span aria-hidden="true">💡</span>
          填写兼容 OpenAI 格式的服务端点地址。请求会发到该地址下的 /chat/completions。
        </p>

        <div className="form-stack">
          <div className="settings-label">模型</div>
          {MODEL_ROWS.map((row) => {
            const value = modelsBySlot[row.id] || '';
            return (
              <label key={row.id}>
                <span className="settings-label">{row.label}</span>
                <span className="model-row">
                  <input
                    className="field"
                    value={value}
                    onChange={(event) => setSlot(row.id, event.target.value)}
                    placeholder={row.placeholder}
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    className="model-icon-btn"
                    aria-label={`获取${row.label}的模型列表`}
                    onClick={refreshModels}
                    disabled={busy}
                  >
                    <Symbol name="download" size={16} />
                  </button>
                  <ModelPicker
                    label={row.label}
                    ids={modelIds}
                    value={value}
                    open={openPicker === row.id}
                    onToggle={() => setOpenPicker((current) => (current === row.id ? '' : row.id))}
                    onClose={() => setOpenPicker('')}
                    onSelect={(id) => {
                      setSlot(row.id, id);
                      setOpenPicker('');
                    }}
                  />
                </span>
              </label>
            );
          })}
        </div>

        <p className="card-note">只存在这台机器的 localStorage。某一行空着时使用默认模型。</p>

        <div className="form-stack">
          <div className="settings-label">JEV</div>
          <label className="settings-label">API Key
            <span className="field-affix">
              <input
                ref={jevKeyRef}
                className={showJevKey ? 'field' : 'field is-masked'}
                type="text"
                value={jevApiKey}
                onChange={(event) => setJevApiKey(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="field-affix-btn"
                aria-label={showJevKey ? '隐藏 JEV API Key' : '显示 JEV API Key'}
                onClick={() => setShowJevKey((value) => !value)}
              >
                <Symbol name={showJevKey ? 'eye-off' : 'eye'} size={16} />
              </button>
            </span>
          </label>
          <label className="settings-label">请求地址
            <input
              className="field"
              value={jevBaseUrl}
              onChange={(event) => setJevBaseUrl(event.target.value)}
              placeholder={DEFAULT_JEV_BASE_URL}
              spellCheck="false"
            />
          </label>
          <label>
            <span className="settings-label">模型</span>
            <span className="model-row">
              <input
                className="field"
                value={jevModel}
                onChange={(event) => setJevModel(event.target.value)}
                placeholder="jev-latest"
                spellCheck="false"
              />
              <button
                type="button"
                className="model-icon-btn"
                aria-label="获取 JEV 模型列表"
                onClick={refreshJevModels}
                disabled={busy}
              >
                <Symbol name="download" size={16} />
              </button>
              <ModelPicker
                label="JEV"
                ids={jevModelIds}
                value={jevModel}
                open={openPicker === 'jev'}
                onToggle={() => setOpenPicker((current) => (current === 'jev' ? '' : 'jev'))}
                onClose={() => setOpenPicker('')}
                onSelect={(id) => {
                  setJevModel(id);
                  setOpenPicker('');
                }}
              />
            </span>
          </label>
        </div>
        <p className="card-note">决策模型，和上面的对话模型分开。Key 空着时不判断。模型空着时用 jev-latest。只发送文字。</p>
        <p className="status-line">{status}</p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => app.exportService.downloadJSON()}>导出 JSON</button>
          <button type="button" className="btn btn-primary" onMouseDown={holdSecrets} onClick={persist}>保存</button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string[]} props.ids
 * @param {string} props.value
 * @param {boolean} props.open
 * @param {() => void} props.onToggle
 * @param {() => void} props.onClose
 * @param {(id: string) => void} props.onSelect
 */
function ModelPicker({ label, ids, value, open, onToggle, onClose, onSelect }) {
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [query, setQuery] = useState('');
  const [box, setBox] = useState(null);
  const grouped = groupModelIds(ids, query);
  const empty = grouped.ungrouped.length === 0 && grouped.groups.length === 0;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 300;
      const height = 320;
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight ? Math.max(8, rect.top - 6 - height) : below;
      setBox({ left, top, width });
    };
    place();
    const onPointer = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && box) searchRef.current?.focus();
  }, [open, box]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={open ? 'model-icon-btn is-open' : 'model-icon-btn'}
        aria-label={`选择${label}的模型`}
        aria-expanded={open}
        disabled={!ids.length}
        onClick={onToggle}
      >
        <Symbol name="chevron-down" size={16} />
      </button>
      {open && box ? createPortal(
        <div
          ref={panelRef}
          className="model-menu"
          role="listbox"
          aria-label={`${label}的模型`}
          style={{ left: box.left, top: box.top, width: box.width }}
        >
          <label className="model-menu-search">
            <Symbol name="search" size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索模型..."
              aria-label="搜索模型"
              spellCheck="false"
            />
          </label>
          <div className="model-menu-list">
            {empty ? <p className="model-menu-empty">没有匹配的模型</p> : null}
            {grouped.ungrouped.map((id) => (
              <ModelOption key={id} id={id} current={id === value} onSelect={onSelect} />
            ))}
            {grouped.groups.map((group) => (
              <div key={group.label}>
                <div className="model-menu-group">{group.label}</div>
                {group.ids.map((id) => (
                  <ModelOption key={id} id={id} current={id === value} onSelect={onSelect} />
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

/**
 * @param {{ id: string, current: boolean, onSelect: (id: string) => void }} props
 */
function ModelOption({ id, current, onSelect }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={current}
      className={current ? 'model-menu-item is-current' : 'model-menu-item'}
      onClick={() => onSelect(id)}
    >
      {id}
    </button>
  );
}

/** @param {Partial<typeof EMPTY_MODELS>} settings */
function slotValues(settings) {
  return {
    model: settings?.model || '',
    agentModel: settings?.agentModel || '',
    breakdownModel: settings?.breakdownModel || '',
    tagModel: settings?.tagModel || '',
    standardizeModel: settings?.standardizeModel || ''
  };
}

