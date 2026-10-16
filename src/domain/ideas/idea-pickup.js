import { ideaBody, ideaTitle, markdownForModel } from './idea-document.js';

export const IDEA_PICKUP_SYSTEM = '把一条灵感拆成今天可以做的任务。只输出 JSON 数组，不要其他文字。1 到 8 条，每条是 {"title":"...","note":"..."}。title 是任务标题，note 是说明。';

export class IdeaPickupParseError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'IdeaPickupParseError';
  }
}

/** @param {any} idea */
export function buildIdeaPickupPrompt(idea) {
  return `标题：${ideaTitle(idea)}\n\n正文：\n${markdownForModel(ideaBody(idea))}`;
}

/**
 * @param {string} text
 * @returns {{ title: string, note: string }[]}
 */
export function parseIdeaPickup(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new IdeaPickupParseError('拆解结果读不出来');
  }
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.tasks) ? data.tasks : null);
  if (!list || list.length < 1 || list.length > 8) throw new IdeaPickupParseError('拆解结果读不出来');
  return list.map((item) => {
    if (!item || typeof item !== 'object') throw new IdeaPickupParseError('拆解结果读不出来');
    if (typeof item.title !== 'string' || !item.title.trim()) throw new IdeaPickupParseError('拆解结果读不出来');
    if (typeof item.note !== 'string') throw new IdeaPickupParseError('拆解结果读不出来');
    return { title: item.title.trim(), note: item.note };
  });
}
