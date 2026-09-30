/**
 * Leading project prefix: 【项目名】任务标题
 * Name cannot contain 【 or 】. Title after the prefix must be non-empty.
 * @param {string} input
 * @returns {{ name: string, text: string } | null}
 */
export function parseProjectTitle(input) {
  const raw = String(input || '').trim();
  const match = raw.match(/^【([^【】]+)】\s*(.*)$/);
  if (!match) return null;
  const name = match[1].trim();
  const text = match[2].trim();
  if (!name || !text) return null;
  return { name, text };
}

/**
 * @param {string} name
 * @param {string} text
 * @returns {string}
 */
export function formatProjectTaskTitle(name, text) {
  return `【${name}】${text}`;
}
