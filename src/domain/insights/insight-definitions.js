/**
 * 首页四个洞察模块。数字和句子都来自同一份快照，不调用模型。
 */

import { formatRate } from './insight-snapshot.js';

/**
 * @param {import('./insight-snapshot.js').ReturnType<import('./insight-snapshot.js').buildInsightSnapshot>} snapshot
 */
function completionText(snapshot) {
  const { last7, prev7, last30 } = snapshot.completion;
  if (!last7.total) return '近 7 天没有必做任务。';
  return `近 7 天完成 ${last7.completed}/${last7.total}（${formatRate(last7.rate)}），前 7 天 ${formatRate(prev7.rate)}，近 30 天 ${formatRate(last30.rate)}。`;
}

function rhythmText(snapshot) {
  const { rhythm } = snapshot;
  const base = `活跃 ${rhythm.activeDays} 天，当前连续 ${rhythm.currentStreak} 天，最长 ${rhythm.longestStreak} 天。`;
  if (!rhythm.weakest) return base;
  return `${base}${rhythm.weakest.weekday}完成率最低，为 ${formatRate(rhythm.weakest.rate)}。`;
}

function tagText(snapshot) {
  const rows = snapshot.tags.rows;
  if (!rows.length) return '还没有标签。';
  const done = rows.reduce((sum, row) => sum + row.done, 0);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const base = `标签任务完成 ${done}/${total}。`;
  const stalled = snapshot.tags.stalled;
  if (!stalled.length) return base;
  return `${base}近 7 天没有推进：${stalled.join('、')}。`;
}

function ideaText(snapshot) {
  const { ideas } = snapshot;
  const parts = [`共 ${ideas.total} 条，可捡起 ${ideas.ready}，等待 ${ideas.waiting}，已完成 ${ideas.completed}。`];
  if (ideas.averageDwellDays != null) parts.push(`未完成平均滞留 ${ideas.averageDwellDays} 天。`);
  if (ideas.overdueCount) parts.push(`过期 ${ideas.overdueCount} 条。`);
  return parts.join('');
}

export const INSIGHT_DEFS = [
  {
    id: 'completion',
    title: '完成率趋势',
    headline(snapshot) {
      return { value: formatRate(snapshot.completion.last7Rate), caption: '近 7 天完成率' };
    },
    text: completionText
  },
  {
    id: 'rhythm',
    title: '节奏与连续性',
    headline(snapshot) {
      return { value: `${snapshot.rhythm.currentStreak} 天`, caption: '当前连续' };
    },
    text: rhythmText
  },
  {
    id: 'tags',
    title: '标签推进',
    headline(snapshot) {
      const rows = snapshot.tags.rows;
      const done = rows.reduce((sum, row) => sum + row.done, 0);
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      return { value: total ? `${done}/${total}` : '—', caption: '标签任务完成' };
    },
    text: tagText
  },
  {
    id: 'ideas',
    title: '灵感转化',
    headline(snapshot) {
      return { value: String(snapshot.ideas.ready), caption: '可捡起' };
    },
    text: ideaText
  }
];

/** @param {string} id */
export function insightDefById(id) {
  return INSIGHT_DEFS.find((item) => item.id === id) || null;
}
