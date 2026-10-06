/**
 * AI 日报提示词。只接收已经整理好的文本，不读存储、不发起请求。
 * 输出是给自己的综合日报和建议，不是某一条业务线的团队日报。
 */

/**
 * @param {Array<{ label?: string, text?: string, note?: string }>|null|undefined} list
 * @param {string} empty
 * @returns {string}
 */
export function formatBullets(list, empty) {
  const rows = (list || []).filter((item) => item && (item.label || item.text));
  if (!rows.length) return empty;
  return rows
    .map((item) => {
      const note = item.note ? `（${item.note}）` : '';
      return `- ${item.label || item.text}${note}`;
    })
    .join('\n');
}

/**
 * @param {string} dateKey
 * @param {string} milestoneDate
 * @returns {string}
 */
function milestoneWhen(dateKey, milestoneDate) {
  const start = Date.parse(`${dateKey}T00:00:00`);
  const target = Date.parse(`${milestoneDate}T00:00:00`);
  if (Number.isNaN(start) || Number.isNaN(target)) return milestoneDate || '未写日期';
  const days = Math.round((target - start) / 86400000);
  if (days === 0) return `${milestoneDate}，就是今天`;
  if (days > 0) return `${milestoneDate}，还有 ${days} 天`;
  return `${milestoneDate}，已过 ${-days} 天`;
}

/**
 * @param {Array<{ name?: string, tasks?: Array<{ text?: string, completed?: boolean }> }>|null|undefined} projects
 * @returns {string}
 */
function formatProjects(projects) {
  const rows = projects || [];
  if (!rows.length) return '（没有项目）';
  return rows
    .map((project) => {
      const tasks = project.tasks || [];
      const done = tasks.filter((task) => task && task.completed).length;
      const open = tasks.filter((task) => task && task.text && !task.completed).map((task) => task.text);
      const openText = open.length ? open.join('、') : '没有未完成任务';
      return `- ${project.name || '未命名项目'}：${done}/${tasks.length} 已完成。未完成：${openText}`;
    })
    .join('\n');
}

/**
 * @param {string} dateKey
 * @param {Array<{ title?: string, date?: string, completed?: boolean }>|null|undefined} milestones
 * @returns {string}
 */
function formatMilestones(dateKey, milestones) {
  const rows = milestones || [];
  if (!rows.length) return '（没有里程碑）';
  return rows
    .map((item) => {
      const when = item.completed ? `${item.date || '未写日期'}，已完成` : milestoneWhen(dateKey, item.date || '');
      return `- ${item.title || '未命名里程碑'}：${when}`;
    })
    .join('\n');
}

/**
 * @param {object} input
 * @param {string} input.dateKey
 * @param {any[]} [input.required]
 * @param {any[]} [input.optional]
 * @param {any[]} [input.ideas]
 * @param {any[]} [input.projects]
 * @param {any[]} [input.milestones]
 * @param {string} [input.reflection]
 * @returns {string}
 */
export function buildDailyReportPrompt({ dateKey, required, optional, ideas, projects, milestones, reflection }) {
  const doneRequired = (required || []).filter((task) => task && task.completed);
  const openRequired = (required || []).filter((task) => task && !task.completed);
  const doneOptional = (optional || []).filter((task) => task && task.completed);
  const openOptional = (optional || []).filter((task) => task && !task.completed);
  const openIdeas = (ideas || []).filter((idea) => idea && !idea.completed);
  return [
    '根据下面这份当天记录，写一份给自己看的日报，并给出下一步建议。',
    '这不是发给团队的业务线汇报。不要使用「某BU 月.日 日报」，也不要分成「左侧」「右侧」。',
    '只根据记录里写明的事实。没有的进展、人物、数字不要编。',
    '',
    '用 Markdown 写出这五节，标题用下面这几个字：',
    '',
    '## 今天',
    '两三句话。把已完成的事、还没做完的事、项目进度和临近的里程碑放在一起说：今天实际推进了什么，哪里还开着。',
    '',
    '## 已完成',
    '只列已完成的必做和选做。一条一行，用「- 」。都没完成就写：今天还没有勾掉任务。',
    '',
    '## 未完成',
    '只列未完成的必做和选做。如果某一件会碰到下面某个项目缺口或临近里程碑，在同一行点明。都完成了就写：必做和选做都已完成。',
    '',
    '## 项目与里程碑',
    '对照项目完成情况和里程碑日期，指出今天最该接着动的一个项目或一个里程碑。没有项目也没有里程碑就写：还没有项目或里程碑。',
    '',
    '## 建议',
    '写 3 条明天可以动手的建议。每条必须落到某一件未完成任务、某个项目里还没完成的任务，或一条未完成的灵感。不要写空泛的鼓励。',
    '',
    '【当天记录】',
    `日期：${dateKey}`,
    '',
    '已完成的必做：',
    formatBullets(doneRequired, '（无）'),
    '',
    '未完成的必做：',
    formatBullets(openRequired, '（无）'),
    '',
    '已完成的选做：',
    formatBullets(doneOptional, '（无）'),
    '',
    '未完成的选做：',
    formatBullets(openOptional, '（无）'),
    '',
    '项目：',
    formatProjects(projects),
    '',
    '里程碑：',
    formatMilestones(dateKey, milestones),
    '',
    '未完成的灵感：',
    formatBullets(openIdeas, '（无）'),
    '',
    '当日反思：',
    (reflection || '').trim() || '（未写）'
  ].join('\n');
}

export const DAILY_REPORT_SYSTEM = '你是 CEOS 的日报助手。只根据给出的当天记录写日报和建议。不编造记录里没有的事实，不用团队汇报套话，不用「左侧 / 右侧」或业务线标题。';
