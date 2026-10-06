import React, { useEffect, useState } from 'react';
import { LlmRequestError } from '../../application/llm-service.js';
import { useApp, useShell } from '../app/context.jsx';
import { Modal } from '../components/Modal.jsx';

export function SettingsModal() {
  const app = useApp();
  const shell = useShell();
  const saved = app.llmService.load();
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl);
  const [model, setModel] = useState(saved.model);
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!shell.settingsOpen) return;
    const next = app.llmService.load();
    setBaseUrl(next.baseUrl);
    setModel(next.model);
    setApiKey(next.apiKey);
    setShowKey(false);
    setStatus('');
  }, [shell.settingsOpen, app]);

  if (!shell.settingsOpen) return null;

  function draft() {
    return { baseUrl, model, apiKey };
  }

  function persist() {
    app.llmService.save(draft());
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
      setModels(ids);
      if (ids.length === 0) {
        setStatus('这个地址没有返回模型。可以直接填写模型 ID。');
      } else {
        if (!model || !ids.includes(model)) setModel(ids[0]);
        setStatus(`已读取 ${ids.length} 个模型。`);
      }
    } catch (error) {
      const message = error instanceof LlmRequestError ? error.message : (error?.message || '读取模型失败');
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  const modelOptions = model && !models.includes(model) ? [model, ...models] : models;

  return (
    <Modal title="设置" onClose={shell.closeSettings} wide>
      <div className="form-stack">
        <label className="settings-label">API Key
          <span className="field-affix">
            <input
              className="field"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            <button
              type="button"
              className="field-affix-btn"
              aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
              onClick={() => setShowKey((value) => !value)}
            >
              <EyeIcon open={showKey} />
            </button>
          </span>
        </label>

        <div>
          <div className="settings-label-row">
            <span className="settings-label">API 请求地址</span>
            <button type="button" className="btn btn-quiet" onClick={test} disabled={busy}>测试连接</button>
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

        <div>
          <div className="settings-label">默认模型</div>
          <div className="model-row">
            <input
              className="field"
              list="llm-model-options"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="选择或填写模型 ID"
              spellCheck="false"
            />
            <datalist id="llm-model-options">
              {modelOptions.map((id) => <option key={id} value={id} />)}
            </datalist>
            <button type="button" className="btn" onClick={refreshModels} disabled={busy}>获取模型列表</button>
          </div>
        </div>

        <p className="card-note">只存在这台机器的 localStorage。洞察和 AI 日报都走这组 OpenAI 兼容配置。</p>
        <p className="status-line">{status}</p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => app.exportService.downloadJSON()}>导出 JSON</button>
          <button type="button" className="btn btn-primary" onClick={persist}>保存</button>
        </div>
      </div>
    </Modal>
  );
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {open
        ? <path d="M3 3l18 18M10.5 10.7A2 2 0 0 0 13.3 13.5M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9.3 3.1 11 7-1 2.2-2.6 4-4.6 5.3M6.1 6.7C4.2 8 2.7 9.8 2 12c1.7 3.9 6 7 10 7 1.1 0 2.2-.2 3.2-.5" strokeLinecap="round" />
        : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
    </svg>
  );
}

