/** 创建标签时发给小模型的说明。只收一段 JSON。 */
export const TAG_NAME_SYSTEM = '只输出 JSON：{"project":"<项目名>"}。不解释、不询问，不返回除了 JSON 外任何内容。根据输入把任务归并到项目：可以选择现有项目，也可以创建项目。';

const NEW_PROJECT_LIMIT = 10;

/**
 * @param {object} input
 * @param {string} [input.title]
 * @param {string[]} [input.notes]
 * @param {string[]} [input.projects]
 * @returns {string}
 */
export function buildTagNamePrompt({ title = '', notes = [], projects = [] } = {}) {
  const description = (Array.isArray(notes) ? notes : [])
    .map((note) => String(note || '').trim())
    .filter(Boolean)
    .join('\n');
  const names = (Array.isArray(projects) ? projects : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const projectBlock = names.length ? names.join('\n') : '无';
  const section = (label, body) => (body ? `${label}\n${body}` : label);
  return [
    section('任务名称：', String(title || '').trim()),
    section('任务描述：', description),
    section('现有项目：', projectBlock)
  ].join('\n\n');
}

/**
 * 新建项目只去掉首尾空白，中间空格保留，再取前 10 个 Unicode 字。
 * @param {string} value
 * @returns {string}
 */
export function clipNewProjectName(value) {
  return Array.from(String(value || '').trim()).slice(0, NEW_PROJECT_LIMIT).join('');
}

/**
 * @param {string} name
 * @param {string[]} existingNames
 * @returns {string}
 */
function storedName(name, existingNames) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  const found = (existingNames || []).find((item) => String(item || '').trim() === trimmed);
  return found ? String(found) : '';
}

/**
 * 先按现有项目的全名匹配。对不上才截成新项目名，截断后再对一次现有项目。
 * @param {string} candidate
 * @param {string[]} existingNames
 * @returns {string}
 */
export function resolveProjectName(candidate, existingNames = []) {
  const exact = storedName(candidate, existingNames);
  if (exact) return exact;
  const clipped = clipNewProjectName(candidate);
  if (!clipped) return '';
  return storedName(clipped, existingNames) || clipped;
}

/**
 * 解析 {"project":"..."}。没有返回、不是 JSON 或 project 为空时，用任务标题走同一套规则。
 * @param {string} raw
 * @param {string} [fallbackTitle]
 * @param {string[]} [existingNames]
 * @returns {string}
 */
export function projectNameFromModel(raw, fallbackTitle = '', existingNames = []) {
  let candidate = '';
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    if (parsed && typeof parsed.project === 'string' && parsed.project.trim()) {
      candidate = parsed.project;
    }
  } catch {
    candidate = '';
  }
  return resolveProjectName(candidate || fallbackTitle, existingNames);
}
