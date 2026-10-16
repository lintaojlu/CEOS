/**
 * 只用于生成过程中的那一帧。补上的闭合标记不写回正文。
 * @param {string} source
 * @returns {string}
 */
export function repairStreamingMarkdown(source) {
  const text = String(source ?? '');
  if (!text) return text;
  const fence = unclosedFence(text);
  if (fence) return `${text}\n${fence}`;

  const visible = maskFenced(text);
  let next = text;
  if (odd(visible, '~~')) next += '~~';
  if (odd(maskFenced(next), '**')) next += '**';
  if (odd(maskFenced(next), '__')) next += '__';
  if (oddInlineCode(maskFenced(next))) next += '`';
  if (oddSingle(maskFenced(next), '**', '*')) next += '*';
  if (oddSingle(maskFenced(next), '__', '_')) next += '_';
  return closeLink(next);
}

/**
 * @param {string} text
 * @returns {string}
 */
function unclosedFence(text) {
  /** @type {{ char: string, len: number } | null} */
  let open = null;
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (!match) continue;
    const token = match[1];
    if (!open) open = { char: token[0], len: token.length };
    else if (open.char === token[0] && token.length >= open.len) open = null;
  }
  return open ? open.char.repeat(Math.max(open.len, 3)) : '';
}

/**
 * @param {string} text
 * @returns {string}
 */
function maskFenced(text) {
  const lines = text.split('\n');
  let open = false;
  return lines.map((line) => {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      open = !open;
      return '';
    }
    return open ? '' : line;
  }).join('\n');
}

/**
 * @param {string} text
 * @param {string} marker
 */
function odd(text, marker) {
  const count = text.split(marker).length - 1;
  return count % 2 === 1;
}

/**
 * @param {string} text
 * @param {string} pair
 * @param {string} marker
 */
function oddSingle(text, pair, marker) {
  let count = 0;
  for (const part of text.split(pair)) count += part.split(marker).length - 1;
  return count % 2 === 1;
}

/**
 * @param {string} text
 */
function oddInlineCode(text) {
  const marks = text.match(/(?<!`)`(?!`)/g);
  return !!marks && marks.length % 2 === 1;
}

/**
 * @param {string} text
 */
function closeLink(text) {
  if (/\[[^\]\n]*\]\([^)\n]*$/.test(text)) return `${text})`;
  if (/\[[^\]\n]*$/.test(text)) return `${text}]`;
  return text;
}
