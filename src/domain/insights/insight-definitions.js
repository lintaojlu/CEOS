/**
 * 首页四个洞察模块。headline 用快照里的数字，prompt 把同一份数字交给模型。
 */

import { formatRate } from './insight-snapshot.js';

const SYSTEM = '你是一位帮技术型 CEO 看自己工作节奏的教练。只用给定的数字下结论，不要编造未提供的事实。只写一句中文，不超过 40 个字。不要标题，不要列表，不要铺垫。';

const BREVITY = '用一句不超过 40 个字的中文回答。只说一个观察或一个建议，不要展开。';

/**
 * @param {import('./insight-snapshot.js').ReturnType<import('./insight-snapshot.js').buildInsightSnapshot>} snapshot
 */
function completionPrompt(snapshot) {
  const { last7, prev7, last30 } = snapshot.completion;
  return [
    `今天是 ${snapshot.todayKey}。请解读完成率趋势。`,
    `近 7 天：完成 ${last7.completed}/${last7.total}，完成率 ${formatRate(last7.rate)}。`,
    `再往前 7 天：完成 ${prev7.completed}/${prev7.total}，完成率 ${formatRate(prev7.rate)}。`,
    `近 30 天：完成 ${last30.completed}/${last30.total}，完成率 ${formatRate(last30.rate)}。`,
    '无数据表示那段时间没有任务。',
    BREVITY
  ].join('\n');
}

function rhythmPrompt(snapshot) {
  const { rhythm } = snapshot;
  const weakest = rhythm.weakest
    ? `${rhythm.weakest.weekday} 完成率最低，为 ${formatRate(rhythm.weakest.rate)}（${rhythm.weakest.completed}/${rhythm.weakest.total}）`
    : '还没有足够的日子比较星期几';
  return [
    `今天是 ${snapshot.todayKey}。请解读工作节奏。`,
    `有完成记录的活跃天数 ${rhythm.activeDays}。`,
    `当前连续天数 ${rhythm.currentStreak}。最长连续天数 ${rhythm.longestStreak}。`,
    `${weakest}。`,
    '今天还没有完成任务时，当前连续从昨天起算。',
    BREVITY
  ].join('\n');
}

function projectPrompt(snapshot) {
  const lines = snapshot.projects.rows.length
    ? snapshot.projects.rows.map((row) => `- ${row.name}：${row.done}/${row.total}${row.stalled ? '，近 7 天无新完成' : ''}`)
    : ['- （没有项目）'];
  return [
    `今天是 ${snapshot.todayKey}。请解读项目推进。`,
    '各项目完成情况：',
    ...lines,
    `近 7 天没有新完成、且仍有未完成任务的项目：${snapshot.projects.stalled.join('、') || '无'}。`,
    BREVITY
  ].join('\n');
}

function ideaPrompt(snapshot) {
  const { ideas } = snapshot;
  return [
    `今天是 ${snapshot.todayKey}。请解读灵感是否在转化成行动。`,
    `灵感共 ${ideas.total} 条：可捡起 ${ideas.ready}，等待中 ${ideas.waiting}，已完成 ${ideas.completed}。`,
    `未完成灵感的平均滞留 ${ideas.averageDwellDays == null ? '无数据' : `${ideas.averageDwellDays} 天`}。`,
    `DDL 已过期且未完成 ${ideas.overdueCount} 条。`,
    BREVITY
  ].join('\n');
}

export const INSIGHT_DEFS = [
  {
    id: 'completion',
    title: '完成率趋势',
    system: SYSTEM,
    headline(snapshot) {
      return { value: formatRate(snapshot.completion.last7Rate), caption: '近 7 天完成率' };
    },
    prompt: completionPrompt
  },
  {
    id: 'rhythm',
    title: '节奏与连续性',
    system: SYSTEM,
    headline(snapshot) {
      return { value: `${snapshot.rhythm.currentStreak} 天`, caption: '当前连续' };
    },
    prompt: rhythmPrompt
  },
  {
    id: 'projects',
    title: '项目推进',
    system: SYSTEM,
    headline(snapshot) {
      const rows = snapshot.projects.rows;
      const done = rows.reduce((sum, row) => sum + row.done, 0);
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      return { value: total ? `${done}/${total}` : '—', caption: '项目任务完成' };
    },
    prompt: projectPrompt
  },
  {
    id: 'ideas',
    title: '灵感转化',
    system: SYSTEM,
    headline(snapshot) {
      return { value: String(snapshot.ideas.ready), caption: '可捡起' };
    },
    prompt: ideaPrompt
  }
];

/** @param {string} id */
export function insightDefById(id) {
  return INSIGHT_DEFS.find((item) => item.id === id) || null;
}
