/** 创建标签时发给小模型的说明。只收一段 JSON。 */
export const TAG_NAME_SYSTEM = '只输出 JSON：{"name":"项目名"}。name 最多 10 个字，不要解释。';

/**
 * @param {string} title
 * @returns {string}
 */
export function buildTagNamePrompt(title) {
  return String(title || '').trim();
}

const QUOTES = /["'「」『』“”‘’`]/g;

/**
 * 去掉引号和空白，再按 Unicode 码位截到 10 个字。
 * @param {string} value
 * @returns {string}
 */
export function clipTagName(value) {
  const stripped = String(value || '').replace(QUOTES, '').replace(/\s+/g, '');
  return Array.from(stripped).slice(0, 10).join('');
}

/**
 * 解析模型返回的 JSON。没有名字、没有返回或解析失败时，用任务标题原文。
 * @param {string} raw
 * @param {string} [fallbackTitle]
 * @returns {string}
 */
export function tagNameFromModel(raw, fallbackTitle = '') {
  const fallback = clipTagName(fallbackTitle);
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    const name = clipTagName(parsed && typeof parsed.name === 'string' ? parsed.name : '');
    return name || fallback;
  } catch {
    return fallback;
  }
}
