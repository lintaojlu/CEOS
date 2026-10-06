import React, { useState } from 'react';
import { LlmRequestError } from '../../../application/llm-service.js';
import { INSIGHT_DEFS } from '../../../domain/insights/insight-definitions.js';
import { todayKey } from '../../../domain/shared/date-key.js';
import { useApp, useShell } from '../../app/context.jsx';
import { Card } from '../../components/Card.jsx';
import { StatTile } from '../../components/StatTile.jsx';

export function InsightsCard() {
  const app = useApp();
  const shell = useShell();
  const dateKey = todayKey();
  const snapshot = app.insightService.snapshot(dateKey);
  const cached = app.insightService.getCached(dateKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setBusy(true);
    setError('');
    try {
      await app.insightService.generate(dateKey, { force: true });
    } catch (err) {
      if (err instanceof LlmRequestError && err.code === 'not-configured') setError('not-configured');
      else setError(err?.message || '生成失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="洞察"
      actions={<button type="button" className="btn btn-mono" onClick={generate} disabled={busy}>{busy ? '生成中' : '生成洞察'}</button>}
    >
      {error === 'not-configured' ? (
        <p className="status-line">还没有配置模型。<button type="button" className="btn btn-quiet btn-mono" onClick={shell.openSettings}>打开设置</button></p>
      ) : error ? <p className="status-line">{error}</p> : null}
      <div className="stat-grid">
        {INSIGHT_DEFS.map((def) => {
          const headline = def.headline(snapshot);
          return (
            <StatTile
              key={def.id}
              value={headline.value}
              caption={`${def.title} · ${headline.caption}`}
              text={cached[def.id]?.text || '还没有生成。'}
            />
          );
        })}
      </div>
    </Card>
  );
}
