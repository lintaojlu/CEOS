import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LlmRequestError } from '../../application/llm-service.js';
import { DEFAULT_JEV_BASE_URL } from '../../infrastructure/storage/llm-settings-repository.js';
import { useApp, useShell } from '../app/context.jsx';
import { Symbol } from '../library/index.js';
import { ArchivedIdeas } from './ArchivedIdeas.jsx';
import { groupModelIds } from './model-list.js';
import { readSecret, secretsToSave } from './secret-field.js';
import { DEFAULT_SETTINGS_SECTION, SETTINGS_GROUPS, filterSettingsGroups } from './settings-nav.js';

const MODEL_ROWS = [
  { id: 'model', label: '默认', hint: '其他用途空着时都用它', placeholder: '选择或填写模型 ID' },
  { id: 'agentModel', label: 'Agent', hint: '底部对话框和 Agent 页', placeholder: '同默认' },
  { id: 'breakdownModel', label: '拆解', hint: '把任务拆成人类与 AI 两部分', placeholder: '同默认' },
  { id: 'tagModel', label: '分类', hint: '给新任务挂标签', placeholder: '同默认' },
  { id: 'standardizeModel', label: '标准化', hint: '整理任务标题与说明', placeholder: '同默认' }
];

const EMPTY_MODELS = {
  model: '',
  agentModel: '',
  breakdownModel: '',
  tagModel: '',
  standardizeModel: ''
};

const DATA_TABS = [
  { id: 'archived', label: '归档的灵感' },
  { id: 'export', label: '导出' }
];

const SECTION_LABEL = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.label]))
);

export function SettingsModal() {
  const app = useApp();
  const shell = useShell();
  const saved = app.llmService.load();
  const [section, setSection] = useState(DEFAULT_SETTINGS_SECTION);
  const [dataTab, setDataTab] = useState('archived');
  const [query, setQuery] = useState('');
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
    setQuery('');
  }, [shell.settingsOpen, app]);

  useEffect(() => {
    if (!shell.settingsOpen) return undefined;
    function onKey(event) {
      if (event.key === 'Escape' && !openPicker) shell.closeSettings();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shell.settingsOpen, openPicker, shell]);

  if (!shell.settingsOpen) return null;

  const groups = filterSettingsGroups(query);

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

  function choose(id) {
    setSection(id);
    setStatus('');
    setOpenPicker('');
  }

  function persist() {
    app.llmService.save(draft());
    pressed.current = null;
    setStatus('已保存。');
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
        setStatus(`已读取 ${ids.length} 个模型，点输入框右边的箭头选择。`);
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

  const footer = (
    <div className="settings-footer">
      <p className="settings-status" role="status">{status}</p>
      <button type="button" className="settings-btn is-primary" onMouseDown={holdSecrets} onClick={persist}>保存</button>
    </div>
  );

  function secretField({ inputRef, value, onChange, shown, onToggle, label }) {
    return (
      <span className="field-affix settings-control">
        <input
          ref={inputRef}
          className={shown ? 'field' : 'field is-masked'}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <button
          type="button"
          className="field-affix-btn"
          aria-label={shown ? `隐藏 ${label}` : `显示 ${label}`}
          onClick={onToggle}
        >
          <Symbol name={shown ? 'eye-off' : 'eye'} size={16} />
        </button>
      </span>
    );
  }

  let body = null;
  if (section === 'model') {
    body = (
      <>
        <section className="settings-card">
          <header className="settings-card-head">
            <div>
              <h3 className="settings-card-title">模型服务</h3>
              <p className="settings-card-desc">兼容 OpenAI 格式的服务端点，请求发到该地址下的 /chat/completions。只存在这台机器的应用数据目录。</p>
            </div>
            <button type="button" className="settings-btn" onMouseDown={holdSecrets} onClick={test} disabled={busy}>测试连接</button>
          </header>
          <div className="settings-row">
            <div className="settings-row-label">API Key</div>
            {secretField({
              inputRef: apiKeyRef,
              value: apiKey,
              onChange: setApiKey,
              shown: showKey,
              onToggle: () => setShowKey((value) => !value),
              label: 'API Key'
            })}
          </div>
          <div className="settings-row">
            <div className="settings-row-label">请求地址</div>
            <input
              className="field settings-control"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
              aria-label="API 请求地址"
              spellCheck="false"
            />
          </div>
        </section>

        <section className="settings-card">
          <header className="settings-card-head">
            <div>
              <h3 className="settings-card-title">模型分工</h3>
              <p className="settings-card-desc">不同用途可以用不同模型。某一行空着时使用默认模型。</p>
            </div>
            <button type="button" className="settings-btn" onMouseDown={holdSecrets} onClick={refreshModels} disabled={busy}>获取模型列表</button>
          </header>
          {MODEL_ROWS.map((row) => {
            const value = modelsBySlot[row.id] || '';
            return (
              <div key={row.id} className="settings-row">
                <div>
                  <div className="settings-row-label">{row.label}</div>
                  <div className="settings-row-hint">{row.hint}</div>
                </div>
                <span className="model-row settings-control">
                  <input
                    className="field"
                    value={value}
                    onChange={(event) => setSlot(row.id, event.target.value)}
                    placeholder={row.placeholder}
                    aria-label={`${row.label}模型`}
                    spellCheck="false"
                  />
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
              </div>
            );
          })}
        </section>
        {footer}
      </>
    );
  } else if (section === 'jev') {
    body = (
      <>
        <section className="settings-card">
          <header className="settings-card-head">
            <div>
              <h3 className="settings-card-title">决策模型（JEV）</h3>
              <p className="settings-card-desc">和对话模型分开。Key 空着时不判断，模型空着时用 jev-latest。只发送文字。</p>
            </div>
            <button type="button" className="settings-btn" onMouseDown={holdSecrets} onClick={refreshJevModels} disabled={busy}>获取模型列表</button>
          </header>
          <div className="settings-row">
            <div className="settings-row-label">API Key</div>
            {secretField({
              inputRef: jevKeyRef,
              value: jevApiKey,
              onChange: setJevApiKey,
              shown: showJevKey,
              onToggle: () => setShowJevKey((value) => !value),
              label: 'JEV API Key'
            })}
          </div>
          <div className="settings-row">
            <div className="settings-row-label">请求地址</div>
            <input
              className="field settings-control"
              value={jevBaseUrl}
              onChange={(event) => setJevBaseUrl(event.target.value)}
              placeholder={DEFAULT_JEV_BASE_URL}
              aria-label="JEV 请求地址"
              spellCheck="false"
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-label">模型</div>
            <span className="model-row settings-control">
              <input
                className="field"
                value={jevModel}
                onChange={(event) => setJevModel(event.target.value)}
                placeholder="jev-latest"
                aria-label="JEV 模型"
                spellCheck="false"
              />
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
          </div>
        </section>
        {footer}
      </>
    );
  } else if (section === 'data') {
    body = (
      <>
        <div className="settings-tabs" role="tablist" aria-label="数据管理">
          {DATA_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={dataTab === tab.id}
              className={dataTab === tab.id ? 'settings-tab is-on' : 'settings-tab'}
              onClick={() => setDataTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {dataTab === 'archived' ? <ArchivedIdeas /> : (
          <section className="settings-card">
            <header className="settings-card-head">
              <div>
                <h3 className="settings-card-title">导出数据</h3>
                <p className="settings-card-desc">把每天的任务、标签和灵感导出成一个 JSON 文件。</p>
              </div>
              <button type="button" className="settings-btn" onClick={() => app.exportService.downloadJSON()}>导出 JSON</button>
            </header>
          </section>
        )}
      </>
    );
  }

  return (
    <div className="settings-backdrop" data-tauri-drag-region="false" onMouseDown={shell.closeSettings} role="presentation">
      <div
        className="settings-window"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="settings-nav">
          <button type="button" className="settings-close" aria-label="关闭设置" onClick={shell.closeSettings} />
          <label className="settings-search">
            <Symbol name="search" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索设置项"
              aria-label="搜索设置项"
              spellCheck="false"
            />
          </label>
          <nav className="settings-groups" aria-label="设置分类">
            {groups.length === 0 ? <p className="settings-nav-empty">没有匹配的设置项</p> : null}
            {groups.map((group) => (
              <div key={group.label} className="settings-group">
                <div className="settings-group-label">{group.label}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={section === item.id ? 'settings-nav-item is-active' : 'settings-nav-item'}
                    aria-current={section === item.id ? 'page' : undefined}
                    onClick={() => choose(item.id)}
                  >
                    <Symbol name={item.icon} size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main className="settings-main" aria-label={SECTION_LABEL[section] || '设置'}>
          {body}
        </main>
      </div>
    </div>
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

