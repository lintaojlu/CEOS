/**
 * 把任务标题精简成一句短标题，原标题收进说明。
 * 只整理上下文和模型输出，不读存储、不发起请求。
 */

import { createNote, normalizeNotes } from './daily-task.js';

export const STANDARDIZE_TITLE_LIMIT = 20;

export const STANDARDIZE_SYSTEM = '只输出 JSON：{"title":"<标题>"}。不解释、不询问，不返回除了 JSON 外任何内容。把任务标题精简成一句动宾短语，不超过 20 个字。不要把已有说明里写过的内容再写进标题。';

/**
 * @param {object} input
 * @param {string} [input.title]
 * @param {string[]} [input.notes]
 * @returns {string}
 */
export function buildStandardizePrompt({ title = '', notes = [] } = {}) {
  const blocks = (Array.isArray(notes) ? notes : [])
    .map((note) => String(note || '').trim())
    .filter(Boolean);
  const noteBlock = blocks.length ? blocks.join('\n\n') : '无';
  return [
    `任务标题：\n${String(title || '').trim()}`,
    `已有说明：\n${noteBlock}`
  ].join('\n\n');
}

/**
 * 去掉首尾空白，中间空格保留，再取前 20 个 Unicode 字。
 * @param {string} value
 * @returns {string}
 */
export function clipStandardTitle(value) {
  return Array.from(String(value || '').trim()).slice(0, STANDARDIZE_TITLE_LIMIT).join('');
}

/**
 * 解析 {"title":"..."}。没有返回、不是 JSON 或 title 为空时返回空字符串。
 * @param {string} raw
 * @returns {string}
 */
export function titleFromModel(raw) {
  let candidate = '';
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    if (parsed && typeof parsed.title === 'string') candidate = parsed.title;
  } catch {
    candidate = '';
  }
  return clipStandardTitle(candidate);
}

/**
 * 把原标题插到说明最前面。已有逐字相同的说明则不重复。
 * @param {Array<{ id?: string, text?: string }>|null|undefined} notes
 * @param {string} originalTitle
 * @returns {Array<{ id: string, text: string }>}
 */
export function prependOriginalTitle(notes, originalTitle) {
  const text = String(originalTitle || '').trim();
  const list = normalizeNotes(notes);
  if (!text || list.some((note) => note.text === text)) return list;
  return [createNote(text), ...list];
}
