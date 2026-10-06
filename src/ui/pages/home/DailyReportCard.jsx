import React, { useState } from 'react';
import { LlmRequestError } from '../../../application/llm-service.js';
import { useApp, useShell } from '../../app/context.jsx';
import { Card } from '../../components/Card.jsx';
import { Markdown } from '../../components/Markdown.jsx';

export function DailyReportCard() {
  const app = useApp();
  const shell = useShell();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('根据完成的任务、待完成的任务、项目、里程碑和灵感，生成日报和建议。');
  const report = app.scheduleService.getCurrentData().aiEval || '';

  async function generate() {
    setBusy(true);
    setStatus('正在生成日报…');
    try {
      await app.dailyReportService.generate();
      setStatus('已写入今天的日报。');
    } catch (error) {
      if (error instanceof LlmRequestError && error.code === 'not-configured') {
        setStatus('还没有配置模型。');
      } else {
        setStatus(error?.message || '生成失败');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!report.trim()) {
      setStatus('还没有可复制的日报。');
      return;
    }
    try {
      await navigator.clipboard.writeText(report);
      setStatus('已复制。');
    } catch {
      setStatus('复制失败，请手动选择文本。');
    }
  }

  return (
    <Card
      title="AI 日报"
      note={app.scheduleService.getDateKey()}
      actions={(
        <>
          <button type="button" className="btn btn-mono" onClick={generate} disabled={busy}>{busy ? '生成中' : '生成日报'}</button>
          <button type="button" className="btn btn-quiet btn-mono" onClick={copy}>复制</button>
        </>
      )}
    >
      <p className="status-line">
        {status}
        {status === '还没有配置模型。' ? (
          <button type="button" className="btn btn-quiet btn-mono" onClick={shell.openSettings}>打开设置</button>
        ) : null}
      </p>
      <Markdown text={report} />
    </Card>
  );
}
