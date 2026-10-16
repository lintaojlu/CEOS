/**
 * 对话标题、@ 候选、技能标记，以及 JSONL 重放。
 * 重放只读文件里记下的内容，不重新计算当时的上下文。
 */

export const AGENT_SKILLS = [{ id: 'schedule', name: '日程' }];

export const PERMISSIONS = [
  { id: 'default', label: '默认' },
  { id: 'read', label: '只读' },
  { id: 'auto', label: '自动' }
];

/**
 * @param {string} text
 * @returns {string}
 */
export function threadTitle(text) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  const chars = [...flat].slice(0, 24).join('');
  return chars || '新对话';
}

/**
 * 去掉 /日程。剩下的正文才参与日期和任务判断。
 * @param {string} text
 * @returns {string}
 */
export function stripSkillToken(text) {
  return String(text || '')
    .replace(/(^|\s)\/日程(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} raw
 * @returns {{ currentId: string, threads: any[] }}
 */
export function parseIndex(raw) {
  try {
    const data = JSON.parse(raw || '');
    const threads = Array.isArray(data?.threads) ? data.threads.filter((item) => item && item.id) : [];
    return {
      currentId: typeof data?.currentId === 'string' ? data.currentId : '',
      threads
    };
  } catch {
    return { currentId: '', threads: [] };
  }
}

/**
 * @param {any[]} mentions
 * @returns {string}
 */
export function formatMentions(mentions) {
  const lines = (mentions || []).map((item) => {
    if (!item) return '';
    if (item.kind === 'day') return `- 日期 ${item.date || item.id || ''}`;
    if (item.kind === 'task') return `- 任务 ${item.date || ''} id=${item.id || ''} ${item.title || ''}`.trim();
    if (item.kind === 'tag') return `- 标签 id=${item.id || ''} ${item.title || ''}`.trim();
    if (item.kind === 'idea') return `- 灵感 id=${item.id || ''} ${item.title || ''}`.trim();
    return '';
  }).filter(Boolean);
  return lines.length ? `已挂上的材料：\n${lines.join('\n')}` : '';
}

/**
 * @param {object} world
 * @param {Array<{ id: string, name: string }>} [world.tags]
 * @param {any[]} [world.ideas]
 * @param {Record<string, any>} [world.schedule]
 * @param {string} [world.today]
 */
export function mentionCatalog(world) {
  const tags = world?.tags || [];
  const ideas = world?.ideas || [];
  const schedule = world?.schedule || {};
  const today = world?.today || '';
  /** @type {any[]} */
  const items = [];
  /** @type {Set<string>} */
  const days = new Set();
  if (/^\d{4}-\d{2}-\d{2}$/.test(today)) days.add(today);
  for (const date of Object.keys(schedule)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day = schedule[date];
    for (const list of ['required', 'optional']) {
      for (const task of day?.[list] || []) {
        if (!task?.id) continue;
        days.add(date);
        const title = task.text || '';
        items.push({ kind: 'task', id: task.id, title, date, label: `${date} ${title}`.trim() });
      }
    }
  }
  for (const date of [...days].sort()) {
    items.push({
      kind: 'day',
      id: date,
      title: date,
      date,
      label: date === today ? `${date} 今天` : date
    });
  }
  for (const tag of tags) {
    if (!tag?.id) continue;
    items.push({ kind: 'tag', id: tag.id, title: tag.name || '', date: '', label: tag.name || tag.id });
  }
  for (const idea of ideas) {
    if (!idea?.id) continue;
    items.push({ kind: 'idea', id: idea.id, title: idea.title || idea.text || '', date: '', label: idea.title || idea.text || idea.id });
  }
  return items;
}

/**
 * @param {any[]} items
 * @param {string} query
 */
export function filterMentions(items, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => `${item.label} ${item.title} ${item.date} ${item.id}`.toLowerCase().includes(q));
}

/**
 * @param {string} raw
 */
export function replayTranscript(raw) {
  /** @type {any} */
  const meta = {
    id: '',
    title: '',
    titleLocked: false,
    model: '',
    permission: 'default',
    createdAt: '',
    updatedAt: ''
  };
  /** @type {any[]} */
  const messages = [];
  /** @type {any[]} */
  const modelMessages = [];
  /** @type {any[]} */
  let staged = [];
  /** @type {any} */
  let bubble = null;

  function openBubble() {
    if (!bubble) {
      bubble = { role: 'assistant', text: '', events: [] };
      messages.push(bubble);
    }
    return bubble;
  }

  for (const line of String(raw || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!event || typeof event !== 'object') continue;
    if (event.time) meta.updatedAt = event.time;
    if (event.type === 'meta') {
      meta.id = event.id || meta.id;
      meta.title = event.title || meta.title;
      meta.titleLocked = event.titleLocked === true;
      meta.model = event.model || meta.model;
      meta.permission = event.permission || meta.permission;
      meta.createdAt = event.time || meta.createdAt;
    } else if (event.type === 'title') {
      meta.title = event.title || meta.title;
      meta.titleLocked = event.locked === true;
    } else if (event.type === 'settings') {
      if (typeof event.model === 'string') meta.model = event.model;
      if (typeof event.permission === 'string') meta.permission = event.permission;
    } else if (event.type === 'user') {
      bubble = null;
      messages.push({
        role: 'user',
        text: event.text || '',
        mentions: Array.isArray(event.mentions) ? event.mentions : []
      });
    } else if (event.type === 'reasoning') {
      openBubble().events.push({ kind: 'reasoning', text: event.text || '' });
    } else if (event.type === 'tool_call') {
      openBubble().events.push({
        kind: 'tool_call',
        id: event.id || '',
        name: event.name || '',
        arguments: event.arguments || {}
      });
    } else if (event.type === 'tool_result') {
      openBubble().events.push({
        kind: 'tool_result',
        id: event.id || '',
        name: event.name || '',
        ok: event.ok === true,
        payload: event.payload
      });
    } else if (event.type === 'assistant') {
      openBubble().text = event.text || '';
      bubble = null;
    } else if (event.type === 'staged') {
      staged = Array.isArray(event.calls) ? event.calls : [];
    } else if (event.type === 'model' && event.message) {
      modelMessages.push(event.message);
    }
  }

  return { meta, messages, modelMessages, staged };
}
