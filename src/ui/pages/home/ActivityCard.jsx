import React from 'react';
import { todayKey } from '../../../domain/shared/date-key.js';
import { useApp } from '../../app/context.jsx';
import { Card } from '../../components/Card.jsx';
import { Heatmap } from '../../components/Heatmap.jsx';

export function ActivityCard() {
  const app = useApp();
  const { summary, weeks } = app.statsService.activity(todayKey());
  return (
    <Card className="activity-card" title="活跃情况">
      <div className="activity-stats">
        <div className="activity-stat">
          <div className="activity-figure">{summary.activeDays}<span>天</span></div>
          <div className="activity-caption">活跃天数</div>
        </div>
        <div className="activity-stat">
          <div className="activity-figure">{summary.currentStreak}<span>天</span></div>
          <div className="activity-caption">当前连续天数</div>
        </div>
        <div className="activity-stat">
          <div className="activity-figure">{summary.longestStreak}<span>天</span></div>
          <div className="activity-caption">最长连续天数</div>
        </div>
      </div>
      <Heatmap weeks={weeks} />
    </Card>
  );
}
