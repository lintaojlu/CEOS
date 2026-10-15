import React from 'react';
import { INSIGHT_DEFS } from '../../../domain/insights/insight-definitions.js';
import { useApp } from '../../app/context.jsx';
import { Card } from '../../components/Card.jsx';
import { StatTile } from '../../components/StatTile.jsx';

export function InsightsCard() {
  const app = useApp();
  const view = app.insightService.getView();
  const snapshot = view?.snapshot;

  return (
    <Card title="洞察">
      <div className="stat-grid">
        {INSIGHT_DEFS.map((def) => {
          const headline = snapshot ? def.headline(snapshot) : { value: '—', caption: def.title };
          return (
            <StatTile
              key={def.id}
              value={headline.value}
              caption={snapshot ? `${def.title} · ${headline.caption}` : def.title}
              text={view?.texts[def.id] || ''}
            />
          );
        })}
      </div>
    </Card>
  );
}
