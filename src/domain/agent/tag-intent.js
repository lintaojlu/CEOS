const UNTAG = /摘掉|去掉|不挂|取消标签/;

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
