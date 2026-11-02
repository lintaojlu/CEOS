/**
 * 用户气泡按行还原清单：标题、分段、勾选和缩进。
 * @param {string} text
 * @returns {Array<{ kind: 'gap' } | { kind: 'heading' | 'text', depth: number, text: string } | { kind: 'check', depth: number, mark: string, text: string }>}
 */
export function parseUserMessage(text) {
  return String(text || '').replace(/\r\n/g, '\n').split('\n').map((line) => {
    const indent = line.match(/^[ \t]*/)?.[0] || '';
    const depth = indent.replace(/\t/g, '    ').length;
    const rest = line.slice(indent.length);
    if (!rest) return { kind: 'gap' };
    const check = rest.match(/^([□☐☑✓✔]|\[[ xX]\])\s*(.*)$/);
    if (check) return { kind: 'check', depth, mark: check[1], text: check[2] };
    if (/^【[^】]+】$/.test(rest) || /^[一二三四五六七八九十百]+、/.test(rest)) {
      return { kind: 'heading', depth, text: rest };
    }
    return { kind: 'text', depth, text: rest };
  });
}

/**
 * @param {string} value
 * @returns {string}
 */
export function messageClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
