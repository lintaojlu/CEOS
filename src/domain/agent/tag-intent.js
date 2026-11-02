const UNTAG = /摘掉|去掉|不挂|取消标签/;

/**
 * 把模型传来的 tagId（可能是 id，也可能是标签名）收成真实 id。
 * 对不上时原样返回，交给校验报错。
 * @param {string} raw
 * @param {Array<{ id: string, name: string }>} tags
 * @returns {string}
 */
export function resolveTagId(raw, tags) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const list = tags || [];
  if (list.some((tag) => tag && tag.id === value)) return value;
  const exact = list.find((tag) => tag && tag.name === value);
  if (exact) return exact.id;
  const mentioned = tagsMentioned(value, list);
  if (mentioned.length === 1) return mentioned[0].id;
  return value;
}

/**
 * 标题/说明里只对上一个已有标签名时，用它的 id；对不上或多个则空。
 * @param {string} text
 * @param {Array<{ id: string, name: string }>} tags
 * @returns {string}
 */
export function inferTagIdFromText(text, tags) {
  const mentioned = tagsMentioned(text, tags);
  return mentioned.length === 1 ? mentioned[0].id : '';
}

/**
 * 较长的名字先对上，避免「攀岩」再命中已经被「攀岩项目」盖住的那段。
 * 名字被包含也算：话里的「攀岩」对得上「攀岩项目」。
 * @param {string} text
 * @param {Array<{ id: string, name: string }>} tags
 */
export function tagsMentioned(text, tags) {
  const sorted = [...(tags || [])]
    .filter((tag) => tag && tag.name)
    .sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name, 'zh-CN'));
  let rest = String(text || '');
  /** @type {Array<{ id: string, name: string }>} */
  const found = [];
  for (const tag of sorted) {
    const hit = mentionOf(rest, tag.name);
    if (!hit) continue;
    found.push(tag);
    rest = rest.split(hit).join('');
  }
  return found;
}

/**
 * @param {string} text
 * @param {string} name
 * @returns {string}
 */
function mentionOf(text, name) {
  if (!name || !text) return '';
  if (text.includes(name)) return name;
  for (let length = name.length - 1; length >= 2; length -= 1) {
    const prefix = name.slice(0, length);
    if (text.includes(prefix)) return prefix;
  }
  return '';
}

/**
 * @param {string} text
 * @param {Array<{ id: string, name: string }>} tags
 * @returns {{ mode: 'keep' } | { mode: 'clear' } | { mode: 'set', tagId: string }}
 */
export function tagDirective(text, tags) {
  const source = String(text || '');
  const destinations = [];
  const destinationPattern = /(?:换成|改成|挂上|挂到)([^，。,！!？?\n]*)/g;
  for (const match of source.matchAll(destinationPattern)) {
    for (const tag of tagsMentioned(match[1] || '', tags)) {
      if (!destinations.some((item) => item.id === tag.id)) destinations.push(tag);
    }
  }
  if (/换成|改成|挂上|挂到/.test(source)) {
    if (destinations.length === 1) return { mode: 'set', tagId: destinations[0].id };
    return { mode: 'clear' };
  }
  if (UNTAG.test(source)) return { mode: 'clear' };
  const mentioned = tagsMentioned(source, tags);
  if (mentioned.length === 1) return { mode: 'set', tagId: mentioned[0].id };
  if (mentioned.length > 1) return { mode: 'clear' };
  return { mode: 'keep' };
}
